export const categories=['Comida','Assinaturas','Moradia','Transporte','Lazer','Outros'];
export const uuid=()=>crypto.randomUUID().toUpperCase();
export const month=d=>d.getFullYear()*100+d.getMonth()+1;
export const stamp=d=>month(d)*100+d.getDate();
export const date=(m,d=1)=>new Date(Math.floor(m/100),m%100-1,Math.min(d,new Date(Math.floor(m/100),m%100,0).getDate()),12);
export const swift=d=>d.getTime()/1000-978307200;
export const fromSwift=v=>new Date((v+978307200)*1000);
export const shift=(m,n)=>month(new Date(Math.floor(m/100),m%100-1+n,1));
export const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const parseDate=s=>new Date(s+'T12:00:00');
export const content=(type,value)=>({[type]:type==='deleted'?{}:{_0:value}});
export const value=(entry,type)=>entry?.value?.[type]?._0;
export const expenseRoots=rows=>Object.values(rows).map(r=>value(r,'expense')).filter(Boolean);
export function occurrence(e,m){if(e.monthlyRates?.length){if(e.endsBefore!=null&&m>=e.endsBefore)return null;const rate=e.monthlyRates.filter(r=>r.start<=m).at(-1);if(!rate)return null;return {...e,...rate,category:rate.category||e.category,date:swift(date(m,rate.day)),fixed:true};}const d=e.civilDay?date(Math.floor(e.civilDay/100),e.civilDay%100):fromSwift(e.date);return month(d)===m?{...e,date:swift(d)}:null;}
export const entries=(rows,m)=>expenseRoots(rows).map(e=>occurrence(e,m)).filter(Boolean).sort((a,b)=>b.date-a.date||a.title.localeCompare(b.title));
export const sum=items=>items.reduce((n,e)=>n+e.cents,0);
export const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export const b64=bytes=>btoa(Array.from(new Uint8Array(bytes),n=>String.fromCharCode(n)).join(''));
export const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const enc=new TextEncoder(),dec=new TextDecoder();
export function deposits(rows){return Object.entries(rows).flatMap(([id,r])=>{const p=id.split(':'),cents=value(r,'budget');if(p.length!==4||p[0]!=='savings.v1'||!Number.isSafeInteger(cents)||cents<=0)return [];try{return [{id,box:dec.decode(un64(p[3])),day:Number(p[2]),cents}]}catch{return []}}).sort((a,b)=>b.day-a.day);}
export const depositKey=(box,d)=>`savings.v1:${uuid()}:${stamp(d)}:${b64(enc.encode(box.normalize('NFC')))}`;
export function merge(a,b){const out=Object.assign(Object.create(null),a);for(const [id,e] of Object.entries(b)){const old=out[id];if(!old||e.clock>old.clock||(e.clock===old.clock&&e.device>old.device))out[id]=e;}return out;}
export function validate(rows){if(!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('Formato de dados inválido');for(const e of Object.values(rows)){if(!e||!Number.isSafeInteger(e.clock)||typeof e.device!=='string'||!e.value||typeof e.value!=='object')throw Error('Registro inválido');}return rows;}

// Retain local values when first combining two previously independent vaults.
export function mergeOnRelink(local, remote, device) {
  const combined = merge(local, remote);
  for (const [id, entry] of Object.entries(local)) {
    const incoming = remote[id];
    if (!incoming || JSON.stringify(entry.value) === JSON.stringify(incoming.value)) continue;
    if (entry.clock > incoming.clock) continue;
    if (!Number.isSafeInteger(incoming.clock + 1)) throw Error('Revisão fora do limite.');
    combined[id] = {...entry, clock: incoming.clock + 1, device};
  }
  return combined;
}

// Move deposits as one persisted batch, preserving IDs, dates and amounts.
export function renameBox(rows, oldName, requestedName, device) {
  const name = String(requestedName).trim().normalize('NFC');
  if (!name || name.length > 64) throw Error('Informe um nome de até 64 caracteres.');
  if (name === oldName) return rows;
  const items = deposits(rows).filter(d => d.box === oldName);
  if (!items.length) throw Error('Esta caixinha não existe mais.');
  if (deposits(rows).some(d => d.box !== oldName && d.box.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw Error('Já existe uma caixinha com esse nome.');
  let clock = Math.max(0, ...Object.values(rows).map(e => e.clock));
  const next = {...rows};
  for (const item of items) {
    const parts = item.id.split(':');
    parts[3] = b64(enc.encode(name));
    const id = parts.join(':');
    next[item.id] = {clock: ++clock, device, value: content('deleted')};
    next[id] = {clock: ++clock, device, value: content('budget', item.cents)};
  }
  return next;
}
