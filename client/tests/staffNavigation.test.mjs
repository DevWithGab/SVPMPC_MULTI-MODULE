import test from 'node:test';
import assert from 'node:assert/strict';
import { readSession, portalPath } from '../src/utils/navigation.js';

const storage = (user, module, role) => ({ getItem: key => ({
  token: 'test-token', user: JSON.stringify(user), selectedModule: JSON.stringify({ module, role }),
})[key] });

test('new and legacy Mortuary accounts resolve to their officer workspace', () => {
  for (const [role, target] of [['admin', 'claims_officer'], ['claims_officer', 'claims_officer'], ['treasurer', 'finance_officer'], ['finance_officer', 'finance_officer']]) {
    assert.equal(portalPath('mortuary', role), `/mortuary/${target}`);
    assert.ok(readSession(storage({ role, modules: ['mortuary'] }, 'mortuary', role)));
  }
  assert.equal(portalPath('attendance', 'claims_officer'), '/');
  assert.equal(portalPath('attendance', 'finance_officer'), '/');
});

test('superadmin can restore every workspace without a module assignment', () => {
  for (const [module, role] of [['attendance', 'secretary'], ['attendance', 'scanner_operator'], ['mortuary', 'claims_officer'], ['mortuary', 'finance_officer']]) {
    assert.equal(readSession(storage({ role: 'super_admin' }, module, role)).module, module);
  }
});

test('ordinary staff cannot restore an unassigned module or another role', () => {
  assert.equal(readSession(storage({ role: 'admin', modules: ['attendance'] }, 'mortuary', 'admin')), null);
  assert.equal(readSession(storage({ role: 'secretary', modules: ['attendance'] }, 'attendance', 'admin')), null);
  assert.equal(readSession(storage({ role: 'admin', modules: ['attendance'] }, 'attendance', 'admin')), null);
  assert.equal(portalPath('attendance', 'admin'), '/');
  assert.equal(readSession(storage({ role: 'secretary', modules: ['attendance'] }, 'attendance', 'secretary')).role, 'secretary');
});
