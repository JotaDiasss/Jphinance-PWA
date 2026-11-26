import { validate, uuid } from '../domain/ledger.js';

export function loadState(storage = localStorage) {
  const rows = validate(JSON.parse(storage.getItem('jp.ledger') || '{}'));
  const pair = JSON.parse(storage.getItem('jp.pair') || 'null');
  const device = storage.getItem('jp.device') || uuid();
  storage.setItem('jp.device', device);
  return { rows, pair, device };
}

export function saveLedger(rows, storage = localStorage) {
  storage.setItem('jp.ledger', JSON.stringify(validate(rows)));
}

export function savePair(pair, storage = localStorage) {
  storage.setItem('jp.pair', JSON.stringify(pair));
}
