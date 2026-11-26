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
