import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/domain/ledger.js';
import * as C from '../src/services/crypto.js';

test('recurring expense clamps to last day and respects cancellation', () => {
  const e = {id:'1', title:'Teste', cents:500, date:L.swift(L.date(202611)), fixed:true, monthlyRates:[{start:202611,title:'Teste',cents:500,day:31}]};
  assert.equal(L.fromSwift(L.occurrence(e,202702).date).getDate(),28);
  assert.equal(L.occurrence({...e,endsBefore:202702},202702),null);
});
test('merge preserves newer deletion and independent deposits', () => {
  const a={clock:1,device:'A',value:L.content('budget',100)};
  const b={clock:2,device:'B',value:L.content('deleted')};
  assert.deepEqual({...L.merge({x:a},{x:b,y:a})},{x:b,y:a});
  assert.equal(L.deposits({[L.depositKey('Viagem',new Date())]:a})[0].box,'Viagem');
});
test('AES-GCM authenticates data and preserves Swift ledger format',async()=>{
  const {key}=await C.syncKeys(L.b64(new Uint8Array(32)));
  const rows={budget:{clock:1,device:'A',value:L.content('budget',200)}};
  const blob=await C.seal(rows,key);
  assert.deepEqual(await C.open(blob,key),rows);
  const other=await C.syncKeys(L.b64(new Uint8Array(32).fill(1)));
  await assert.rejects(C.open(blob,other.key));
});

test('trocar de cofre preserva o valor local e incorpora registros exclusivos do destino', async () => {
  const {mergeOnRelink, merge} = await import('../src/domain/ledger.js');
  const entry = (clock, n) => ({clock, device:'device', value:{budget:n}});
  const local = {budget:entry(1,100), savings:entry(2,50)};
  const remote = {budget:entry(5,200), goal:entry(3,500)};
  const result = mergeOnRelink(local, remote, 'phone');
  assert.deepEqual(result.budget, {...local.budget, clock:6, device:'phone'});
  assert.deepEqual(result.savings, local.savings);
  assert.deepEqual(result.goal, remote.goal);
  assert.deepEqual(merge(remote, result), result);
});

test('renomear preserva saldo e histórico e a sincronização não ressuscita o nome antigo',()=>{
 const ids=[L.depositKey('Viagem',L.date(202611,3)),L.depositKey('Viagem',L.date(202611,5))];
 const rows=Object.fromEntries(ids.map((id,i)=>[id,{clock:i+1,device:'mac',value:L.content('budget',(i+1)*100)}]));
 const next=L.renameBox(rows,'Viagem','Férias 🏖','phone');
 const items=L.deposits(L.merge(rows,next));
 assert.equal(L.sum(items),300);
 assert.deepEqual(items.map(d=>d.day),[20261105,20261103]);
 assert.ok(items.every(d=>d.box==='Férias 🏖'));
 assert.ok(ids.every(id=>next[id].value.deleted));
 assert.equal(L.deposits(rows).length,2);
 assert.throws(()=>L.renameBox(next,'Férias 🏖','  ','phone'));
 const withOther={...next,[L.depositKey('Reserva',L.date(202611))]:{clock:9,device:'mac',value:L.content('budget',200)}};
 assert.throws(()=>L.renameBox(withOther,'Férias 🏖','reserva','phone'),/Já existe/);
});
