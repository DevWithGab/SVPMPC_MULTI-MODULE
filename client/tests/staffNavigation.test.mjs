import test from 'node:test';
import assert from 'node:assert/strict';
import { readSession } from '../src/utils/navigation.js';

const storage = (user, module, role) => ({ getItem: key => ({
  token: 'test-token', user: JSON.stringify(user), selectedModule: JSON.stringify({ module, role }),
})[key] });

test('superadmin can restore either admin portal without a module assignment', () => {
  for (const module of ['attendance', 'mortuary']) {
    assert.equal(readSession(storage({ role: 'super_admin' }, module, 'admin')).module, module);
  }
});

test('ordinary staff cannot restore an unassigned module or another role', () => {
  assert.equal(readSession(storage({ role: 'admin', modules: ['attendance'] }, 'mortuary', 'admin')), null);
  assert.equal(readSession(storage({ role: 'secretary', modules: ['attendance'] }, 'attendance', 'admin')), null);
  assert.equal(readSession(storage({ role: 'admin', modules: ['attendance'] }, 'attendance', 'admin')).role, 'admin');
});
