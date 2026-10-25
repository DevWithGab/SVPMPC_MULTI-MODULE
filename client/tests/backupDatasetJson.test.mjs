import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_COLLECTIONS, collectionBackup, isModuleBackup } from '../src/utils/moduleBackup.js';

test('every individual dataset retains raw nested records and restores as a module backup', () => {
  for (const [module, collections] of Object.entries(BACKUP_COLLECTIONS)) {
    const metadata = { format: 'svpmpc-module-backup', version: 2, module, exportedAt: '2026-10-25T00:00:00.000Z', exportedBy: 'Test Admin' };
    const backup = { ...metadata, ...Object.fromEntries(collections.map(([key]) => [key, [{ memberId: '000001', details: { values: [1, null, false] }, note: '=keep original value' }]])) };
    for (const [key] of collections) {
      const dataset = JSON.parse(JSON.stringify(collectionBackup(backup, module, key)));
      assert.deepEqual(dataset, { ...metadata, counts: { [key]: 1 }, [key]: backup[key] });
      assert.equal(isModuleBackup(dataset, module), true);
      assert.deepEqual(collections.filter(([name]) => Array.isArray(dataset[name])).map(([name]) => name), [key]);
    }
  }
});

test('empty datasets remain restorable without inserting other collections', () => {
  assert.deepEqual(collectionBackup({ module: 'attendance', events: [] }, 'attendance', 'events').counts, { events: 0 });
  assert.equal(isModuleBackup(collectionBackup({ events: [] }, 'attendance', 'events'), 'attendance'), true);
});

test('individual exports reject missing, unknown and mismatched datasets', () => {
  assert.throws(() => collectionBackup({}, 'attendance', 'members'));
  assert.throws(() => collectionBackup({ users: [] }, 'attendance', 'users'));
  assert.throws(() => collectionBackup({ module: 'mortuary', members: [] }, 'attendance', 'members'));
});
