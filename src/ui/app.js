import * as L from '../domain/ledger.js';
import {loadState,saveLedger,savePair} from "../services/storage.js";
import * as C from '../services/crypto.js';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(), current=()=>L.month(today()), mname=m=>L.date(m).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}), amount=n=>(n/100).toFixed(2).replace('.',',');
let rows={},pair=null,blocked=false,device,active='home',selected=current(),day=null,busy=false,pending=false,pairing=false,handler;
try{({rows,pair,device}=loadState())}catch{blocked=true;$('status').textContent='Erro ao abrir dados locais';}
const status=s=>$('status').textContent=s;
function persist(next){if(blocked)throw Error('Dados locais bloqueados.');saveLedger(next);rows=next;}
function set(id,v){persist({...rows,[id]:{clock:Math.max(0,...Object.values(rows).map(e=>e.clock))+1,device,value:v}});render();sync();}
async function sync(){if(!pair||blocked||pairing)return;if(busy){pending=true;return}busy=true;status('Sincronizando…');try{const {token,key}=await C.syncKeys(pair.secret);let tries=0;do{pending=false;const remote=await C.request(pair.origin,{token,op:'get'});if(!Number.isSafeInteger(remote.rev))throw Error('Revisão inválida');const other=await C.open(remote.blob,key);const combined=pair.keepLocal?L.mergeOnRelink(rows,other,device):L.merge(rows,other);persist(combined);render();if(Object.keys(combined).length!==Object.keys(other).length||Object.keys(combined).some(k=>combined[k].clock!==other[k]?.clock||combined[k].device!==other[k]?.device)){const packet=await C.seal(combined,key);const reply=await C.request(pair.origin,{token,op:'put',rev:remote.rev,blob:packet});if(reply.conflict)pending=true;else if(reply.rev!==remote.rev+1)throw Error('Revisão inválida')}if(pair.keepLocal&&!pending){const {keepLocal,...verified}=pair;savePair(verified);pair=verified}}while(pending&&++tries<5);status(pending?'Sincronização pendente':'Sincronizado');}catch{status('Salvo localmente · sync pendente')}finally{busy=false}}
const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',agenda:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',monthly:'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5',goal:'M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5',savings:'m3 7 9-4 9 4-9 4Zm0 0v10l9 4 9-4V7M12 11v10',settings:'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4',plus:'M12 5v14M5 12h14',edit:'m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',sync:'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5',pair:'m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',budget:'M3 7h18v13H3V5a2 2 0 0 1 2-2h13v4m3 5h-6v4h6'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.plus}"/></svg>`;
const pages=[['home','Resumo'],['agenda','Agenda'],['monthly','Fixos'],['goal','Meta'],['savings','Caixinhas'],['settings','Ajustes']];
const button=(label,action,arg='',cls='')=>{const name=action==='month'?(Number(arg)<0?'left':'right'):({expense:arg?'edit':'plus',recurring:'plus',deposit:'plus',rename:'edit',delete:'delete',goal:'goal',budget:'budget',sync:'sync',pair:'pair'})[action];const text=String(label).replace(/^\+\s*/, '');return `<button class="${cls}" data-action="${action}" data-arg="${esc(arg)}" ${action==='month'?`aria-label="${Number(arg)<0?'Mês anterior':'Próximo mês'}"`:''}>${name?icon(name):''}${action==='month'?'':`<span>${esc(text)}</span>`}</button>`;};
const card=(title,body,cls='')=>`<section class="card ${cls}">${title?`<h2>${esc(title)}</h2>`:''}${body}</section>`;
const big=(n)=>`<div class="amount ${n<0?'negative':'mint'}">${L.money(n)}</div>`;
const row=(label,cents)=>`<div class="row entry"><span>${esc(label)}</span><strong>${L.money(cents)}</strong></div>`;
const expenseRow=e=>`<div class="row entry"><div><strong>${esc(e.title)}</strong><small>${esc(e.category)} · ${L.fromSwift(e.date).toLocaleDateString('pt-BR')}${e.monthlyRates?.length?' · Mensal':''}</small></div><div><strong>${L.money(e.cents)}</strong><div class="actions">${button('Editar','expense',e.id)}${button('Excluir','delete',e.id,'danger')}</div></div></div>`;
function render(){const expenses=L.entries(rows,current()),spent=L.sum(expenses),budget=L.value(rows.budget,'budget')||0,goal=L.value(rows.goal,'goal'),savings=L.deposits(rows);let html='';if(!$('nav').children.length)$('nav').innerHTML=`<div class="nav-indicator" style="--tab:${pages.findIndex(([id])=>id===active)}"></div>`+pages.map(([id,label])=>`<button class="${active===id?'active':''}" data-action="page" data-arg="${id}" ${active===id?'aria-current="page"':''}>${icon(id)}<span>${label}</span></button>`).join('');updateNavIndicator();for(const tab of $('nav').querySelectorAll('button')){const chosen=tab.dataset.arg===active;tab.classList.toggle('active',chosen);if(chosen)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current')}
if(active==='home'){const totals={};for(const e of expenses)totals[e.category]=(totals[e.category]||0)+e.cents;html=`<h1>Seu dinheiro, claro.</h1>${card('Disponível neste mês',big(budget-spent)+`<div class="row"><div><small>Orçamento</small><strong>${L.money(budget)}</strong></div><div><small>Gastos</small><strong>${L.money(spent)}</strong></div></div><div class="actions">${button('+ Novo gasto','expense','','primary')}${button('Orçamento','budget')}</div>`,'hero')}<div class="grid">${card('Por categoria',Object.entries(totals).map(([k,v])=>`<div class="row"><span>${esc(k)}</span><strong>${L.money(v)}</strong></div><div class="bar" style="width:${100*v/Math.max(1,spent)}%"></div>`).join('')||'<p>Nenhum gasto neste mês.</p>')}${card('Caixinhas',big(L.sum(savings))+button('Abrir caixinhas','page','savings'))}${card('Últimos gastos',expenses.filter(e=>L.stamp(L.fromSwift(e.date))<=L.stamp(today())).slice(0,4).map(expenseRow).join('')||'<p>Seus lançamentos aparecem aqui.</p>')}</div>`;}
if(active==='agenda'){const es=L.entries(rows,selected),first=L.date(selected),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();let cells=['D','S','T','Q','Q','S','S'].map(s=>`<small>${s}</small>`).join('')+'<span></span>'.repeat(first.getDay());for(let d=1;d<=days;d++)cells+=button(d,'day',d,(day===d?'chosen ':'')+(es.some(e=>L.fromSwift(e.date).getDate()===d)?'marked':''));const filtered=day?es.filter(e=>L.fromSwift(e.date).getDate()===day):es;html=`<h1>Agenda</h1>${card('',`<div class="row month">${button('‹','month',-1)}<strong>${mname(selected)}</strong>${button('›','month',1)}</div><div class="calendar">${cells}</div><div class="actions">${button('Mês inteiro','day','')}${button('+ Gasto','expense','','primary')}</div>`)}${card(day?'Dia '+day:'Mês inteiro',big(L.sum(filtered))+filtered.map(expenseRow).join('')+(filtered.length?'':'<p>Nenhum lançamento.</p>')+row('Mês anterior',L.sum(L.entries(rows,L.shift(selected,-1)))))}`;}
if(active==='monthly'){const es=L.expenseRoots(rows).filter(e=>e.monthlyRates?.length&&e.endsBefore==null).map(e=>L.occurrence(e,Math.max(current(),e.monthlyRates[0].start))).filter(Boolean);html=`<h1>Gastos fixos</h1>${card('Total deste mês',big(L.sum(expenses.filter(e=>e.monthlyRates?.length)))+button('+ Nova cobrança','recurring','','primary'))}${card('Cobranças mensais',es.map(expenseRow).join('')||'<p>Nenhuma cobrança cadastrada.</p>')}`;}
if(active==='goal'){let body=button('Criar meta','goal','','primary');if(goal){const remain=Math.max(0,goal.target-goal.saved),deadline=L.fromSwift(goal.deadline),months=Math.max(1,(deadline.getFullYear()-today().getFullYear())*12+deadline.getMonth()-today().getMonth()+1),avg=Math.ceil(remain/months),now=Math.min(avg,Math.max(0,budget-spent)),future=months>1?Math.ceil((remain-now)/(months-1)):0;body=`<h2>${esc(goal.title)}</h2>${big(goal.saved)}<progress max="${Math.max(1,goal.target)}" value="${Math.min(goal.saved,goal.target)}"></progress><p>De ${L.money(goal.target)} · até ${deadline.toLocaleDateString('pt-BR')}</p><p>${esc(goal.notes)}</p><div class="actions">${button('Editar meta','goal')}${button('Excluir','delete','goal','danger')}</div>`+`</section>${card('Plano de economia',remain===0?'<p>Meta alcançada!</p>':L.stamp(deadline)<L.stamp(today())?'<p>Prazo encerrado.</p>':row('Falta guardar',remain)+row('Reserve neste mês',now)+(months>1?row('Por mês depois',future):'')+row('Valor ainda sem cobertura',months===1?remain-now:Math.max(0,future-(budget-spent)-L.sum(expenses.filter(e=>!e.fixed&&e.category!=='Gastos fixos')))))}<section hidden>`;}html=`<h1>Minha meta</h1>${card('',body)}`;}
if(active==='savings'){const groups=new Map();for(const d of savings){if(!groups.has(d.box))groups.set(d.box,[]);groups.get(d.box).push(d)}html=`<h1>Caixinhas</h1>${card('Total guardado',big(L.sum(savings))+button('+ Guardar dinheiro','deposit','','primary'),'hero')}${[...groups].map(([name,items])=>card(name,big(L.sum(items))+`<div class="actions">${button('Guardar aqui','deposit',name)}${button('Renomear','rename',name)}</div>`+`<details><summary>Ver histórico</summary>${items.map(d=>`<div class="row entry"><span>${d.day%100}/${Math.floor(d.day/100)%100}/${Math.floor(d.day/10000)}</span><strong>${L.money(d.cents)}</strong>${button('Excluir','delete',d.id,'danger')}</div>`).join('')}</details>`)).join('')||'<p>Crie sua primeira caixinha.</p>'}`;}
if(active==='settings')html=`<h1>Ajustes</h1>${card('Sincronização',`<p>${pair?'Conectado a '+esc(pair.origin):'Cole o mesmo link privado usado no Mac.'}</p><div class="actions sync-actions">${button(pair?'Alterar link de sincronização':'Conectar link','pair','','primary')}${pair?button('Sincronizar agora','sync'):''}</div><p>Os dados compartilhados são criptografados antes do envio. O navegador precisa ter acesso ao servidor de sincronização.</p>`)}${card('Instalar no iPhone','<p>Abra no Safari, toque em Compartilhar → Adicionar à Tela de Início. Abra pelo novo ícone.</p><p>Seus registros são salvos neste aparelho.</p>')}`;
$('screen').innerHTML=html;}
const field=(name,label,type='text',v='',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(v)}" ${extra}></label>`;
const cents=v=>{const s=String(v).trim().replace(',','.');if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw Error('Informe um valor válido (ex.: 25,90).');return Math.round(Number(s)*100)};
const moneyField=(name,label,v=0)=>field(name,label,'text',amount(v),'inputmode="decimal" required');
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let savedScroll=0,closingEditor=false,pageMotion=null,queuedPage=null;
function modal(title,fields,fn){
  const editor=$('editor');
  $('form-title').textContent=title;$('fields').innerHTML=fields;$('error').textContent='';handler=fn;
  savedScroll=window.scrollY;
  document.body.style.top=`-${savedScroll}px`;
  document.body.classList.add('modal-open');
  editor.showModal();editor.scrollTop=0;
}
async function closeEditor(){
  const editor=$('editor');if(!editor.open||closingEditor)return;
  closingEditor=true;
  try{
    if(!reducedMotion())await editor.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(48px)',opacity:0}],{duration:240,easing:'cubic-bezier(.4,0,1,1)'}).finished;
  }finally{editor.close();closingEditor=false;}
}
$('editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor()});
$('editor').addEventListener('close',()=>{
  document.body.classList.remove('modal-open');document.body.style.top='';window.scrollTo(0,savedScroll);
});
function updateNavIndicator(){
  const nav=$('nav'),indicator=nav.querySelector('.nav-indicator');
  const tab=nav.querySelector(`[data-arg="${active}"]`);
  if(!tab||!indicator)return;
  indicator.style.width=`${tab.offsetWidth}px`;
  indicator.style.transform=`translate3d(${tab.offsetLeft-7}px,0,0)`;
}
window.addEventListener('resize',updateNavIndicator);
async function changePage(id){
  if(pageMotion){queuedPage=id;return;}
  if(active===id)return;
  const direction=pages.findIndex(([key])=>key===id)>pages.findIndex(([key])=>key===active)?1:-1;
  const screen=$('screen'),rect=screen.getBoundingClientRect();
  let layer=null,outgoing=null;
  if(!reducedMotion()){
    // Keep the old screen visible while the new screen pushes it away.
    layer=document.createElement('div');layer.className='page-transition-layer';
    layer.setAttribute('aria-hidden','true');layer.inert=true;
    outgoing=screen.cloneNode(true);outgoing.removeAttribute('id');
    outgoing.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    outgoing.className='page-outgoing';
    Object.assign(outgoing.style,{position:'absolute',top:`${rect.top}px`,left:`${rect.left}px`,width:`${rect.width}px`,margin:'0'});
    layer.append(outgoing);document.body.append(layer);
  }
  active=id;render();window.scrollTo({top:0,behavior:'instant'});
  if(!layer)return;
  const distance=document.documentElement.clientWidth;
  const timing={duration:300,easing:'linear',fill:'both'};
  screen.classList.add('page-moving');
  const incoming=screen.animate([{transform:`translate3d(${direction*distance}px,0,0)`},{transform:'translate3d(0,0,0)'}],timing);
  const leaving=outgoing.animate([{transform:'translate3d(0,0,0)'},{transform:`translate3d(${-direction*distance}px,0,0)`}],timing);
  pageMotion=incoming;
  try{await Promise.all([incoming.finished,leaving.finished]);}catch{}finally{
    incoming.cancel();leaving.cancel();layer.remove();screen.classList.remove('page-moving');pageMotion=null;
    const next=queuedPage;queuedPage=null;if(next&&next!==active)changePage(next);
  }
}

function editExpense(id,recurring=false){const root=L.value(rows[id],'expense'),existing=root&&L.occurrence(root,Math.max(current(),root.monthlyRates?.[0]?.start||0)),e=existing||root;recurring=recurring||!!root?.monthlyRates?.length;const d=e?L.fromSwift(e.date):day&&active==='agenda'?L.date(selected,day):today();modal(root?'Editar gasto':recurring?'Nova cobrança':'Novo gasto',field('title','Nome','text',e?.title||'','required maxlength="120"')+moneyField('amount','Valor (R$)',e?.cents||0)+`<label>Categoria<select name="category">${L.categories.map(c=>`<option ${c===e?.category?'selected':''}>${c}</option>`).join('')}</select></label>`+field('date',recurring?'Início da cobrança':'Data','date',L.iso(d),'required')+(recurring?field('due','Dia da cobrança','number',existing?.day||d.getDate(),'min="1" max="31" required'):'<label><input type="checkbox" name="fixed" '+(e?.fixed?'checked':'')+'>Gasto essencial</label>'),f=>{const title=f.get('title').trim(),v=cents(f.get('amount')),dt=L.parseDate(f.get('date')),category=f.get('category');if(!title||v<=0||!Number.isFinite(dt.getTime()))throw Error('Preencha os dados do gasto.');const key=id||L.uuid();let next={id:key,title,cents:v,category,date:L.swift(dt),fixed:recurring||f.has('fixed'),civilDay:L.stamp(dt)};if(recurring){const start=root?Math.max(current(),root.monthlyRates[0].start):L.month(dt);const rate={start,title,cents:v,day:Number(f.get('due')),category};next={...(root||next),monthlyRates:[...(root?.monthlyRates||[]).filter(x=>x.start!==start),rate].sort((a,b)=>a.start-b.start)};}set(key,L.content('expense',next));});}
async function action(a,id){if(a==='page'){changePage(id)}else if(a==='month'){selected=L.shift(selected,Number(id));day=null;render()}else if(a==='day'){day=id?Number(id):null;render()}else if(a==='expense'||a==='recurring')editExpense(id,a==='recurring');else if(a==='budget')modal('Orçamento mensal',moneyField('amount','Orçamento (R$)',L.value(rows.budget,'budget')||0),f=>set('budget',L.content('budget',cents(f.get('amount')))));else if(a==='goal'){const g=L.value(rows.goal,'goal');modal('Minha meta',field('title','Objetivo','text',g?.title||'','required')+moneyField('target','Valor alvo',g?.target||0)+moneyField('saved','Já guardado',g?.saved||0)+field('deadline','Prazo','date',L.iso(g?L.fromSwift(g.deadline):today()),'required')+field('notes','Observações','text',g?.notes||''),f=>{const target=cents(f.get('target'));if(!target||!f.get('title').trim())throw Error('Informe um objetivo e valor.');set('goal',L.content('goal',{title:f.get('title').trim(),target,saved:cents(f.get('saved')),deadline:L.swift(L.parseDate(f.get('deadline'))),notes:f.get('notes')}));});}else if(a==='rename')modal('Renomear caixinha',field('name','Novo nome','text',id,'required maxlength="64"'),f=>{persist(L.renameBox(rows,id,f.get('name'),device));render();sync()});else if(a==='deposit')modal('Guardar dinheiro',field('box','Nome da caixinha','text',id||'Reserva livre','required maxlength="64"')+moneyField('amount','Valor (R$)')+field('date','Data','date',L.iso(today()),'required'),f=>{const name=f.get('box').trim(),v=cents(f.get('amount'));if(!name||!v)throw Error('Informe nome e valor.');const box=L.deposits(rows).find(x=>x.box.toLowerCase()===name.toLowerCase())?.box||name;set(L.depositKey(box,L.parseDate(f.get('date'))),L.content('budget',v));});else if(a==='delete'){if(!confirm('Excluir este registro?'))return;const e=L.value(rows[id],'expense');set(id,e?.monthlyRates?.length?L.content('expense',{...e,endsBefore:Math.min(e.endsBefore||Infinity,current())}):L.content('deleted'));}else if(a==='sync')sync();else if(a==='pair')editPair();}
function editPair() {
  const title = pair ? 'Alterar link de sincronização' : 'Conectar aparelhos';
  const help = pair ? '<p>Ao salvar, seus registros locais serão sincronizados com o cofre do novo link.</p>' : '';
  modal(title, help + field('link', 'Link privado', 'password', '', 'required autocomplete="off" autocapitalize="off" spellcheck="false"'), async form => {
    if (blocked) throw Error('Não foi possível abrir os dados locais.');
    if (busy || pairing) throw Error('Aguarde a sincronização atual e tente novamente.');
    const next = C.parseLink(form.get('link'));
    const editor = $('editor');
    let canceled = false;
    const cancel = () => { canceled = true; };
    editor.addEventListener('close', cancel, {once:true});
    pairing = true;
    try {
      const {token,key} = await C.syncKeys(next.secret);
      const reply = await C.request(next.origin, {token, op:'get'});
      if (!Number.isSafeInteger(reply.rev) || reply.rev < 0 || (reply.rev > 0 && !reply.blob)) throw Error('Servidor incompatível.');
      await C.open(reply.blob, key);
      if (canceled || !editor.open) return;
      if (pair && (pair.origin !== next.origin || pair.secret !== next.secret)) next.keepLocal = true;
      else if (pair?.keepLocal) next.keepLocal = true;
      savePair(next);
      pair = next;
    } catch (err) {
      if (err instanceof TypeError) throw Error('Não foi possível acessar o servidor. Confira o link e a conexão.');
      throw err;
    } finally {
      pairing = false;
      editor.removeEventListener('close', cancel);
    }
    render();
    sync();
  });
}

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)action(b.dataset.action,b.dataset.arg).catch(err=>alert(err.message))});$('cancel').onclick=()=>closeEditor();$('form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{await handler(new FormData(e.target));await closeEditor()}catch(err){$('error').textContent=err.message||'Não foi possível concluir.'}finally{submit.disabled=false}};window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(sync,60000);render();sync();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
