import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionCsv } from '../src/utils/moduleBackup.js';

test('collection CSV includes fields appearing in later records and preserves nested report data', () => {
  const csv = collectionCsv([
    { id: '001', title: 'Assembly, "annual"', details: { present: 12 } },
    { id: '002', details: ['one', 'two'], archived: false },
  ]);
  assert.equal(csv, '\uFEFF"id","title","details","archived"\r\n'
    + '"001","Assembly, ""annual""","{""present"":12}",""\r\n'
    + '"002","","[""one"",""two""]","false"\r\n');
});

test('collection CSV escapes spreadsheet formulas without changing negative numeric values', () => {
  assert.equal(collectionCsv([{ text: ' =SUM(A1)', amount: -25, note: null }]),
    '\uFEFF"text","amount","note"\r\n"\' =SUM(A1)","-25",""\r\n');
});

test('empty datasets still produce a valid UTF-8 CSV header', () => {
  assert.equal(collectionCsv([]), '\uFEFF"_id"\r\n');
});
