import test from 'node:test';
import assert from 'node:assert/strict';
import { importHeaderLabel, normalizeImportHeader, isPassbookHeader } from '../src/utils/importHeaders.js';

test('new and legacy templates map to the same passbook field without changing values', () => {
  for (const header of ['Passbook No.', 'Passbook Number', 'passbook_no', 'memberId', 'member_id', '\uFEFFPassbook No.']) {
    assert.equal(importHeaderLabel(header), 'Passbook No.');
    assert.equal(isPassbookHeader(header), true);
    const columns = [header, 'transactionDate'].map(normalizeImportHeader);
    const values = ['000123', '2026-10-15'];
    assert.equal(values[columns.indexOf('memberId')], '000123');
  }
  assert.equal(normalizeImportHeader('transactionDate'), 'transactionDate');
  assert.equal(importHeaderLabel('referenceId'), 'referenceId');
});
