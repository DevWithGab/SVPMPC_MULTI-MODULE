import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTabSession, clearAuthSession, readAuthSession } from '../src/utils/authSession.js';
import { readSession } from '../src/utils/navigation.js';

const storage = (values = {}) => {
  const data = new Map(Object.entries(values));
  return { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) };
};
const account = (role, module) => ({
  token: `test-${role}`, user: JSON.stringify({ role, modules: [module] }),
  selectedModule: JSON.stringify({ role, module }),
});

test('new tabs ignore former shared login while existing tab sessions and preferences survive startup', () => {
  const shared = storage({ ...account('treasurer', 'mortuary'), treasurerSidebarCollapsed: 'true' });
  const first = storage(account('treasurer', 'mortuary'));
  const second = storage();
  initializeTabSession({ localStorage: shared, sessionStorage: second, opener: null });
  assert.equal(readSession(second), null);
  assert.equal(readAuthSession(second), null);
  assert.equal(shared.getItem('token'), null);
  assert.equal(shared.getItem('user'), null);
  assert.equal(shared.getItem('selectedModule'), null);
  assert.equal(shared.getItem('treasurerSidebarCollapsed'), 'true');
  initializeTabSession({ localStorage: shared, sessionStorage: first, opener: null });
  assert.equal(readSession(first).role, 'treasurer', 'a reload retains the tab account');
});

test('logging out or expiring one tab does not clear another tab account', () => {
  const treasurer = storage(account('treasurer', 'mortuary'));
  const secretary = storage(account('secretary', 'attendance'));
  assert.equal(readAuthSession(treasurer).token, 'test-treasurer');
  assert.equal(readAuthSession(secretary).token, 'test-secretary');
  clearAuthSession(secretary);
  assert.equal(readSession(secretary), null);
  assert.equal(readSession(treasurer).role, 'treasurer');
});

test('opener-created windows discard copied credentials without touching the original tab', () => {
  const parent = storage(account('treasurer', 'mortuary'));
  const popup = { localStorage: storage(), sessionStorage: storage(account('treasurer', 'mortuary')), opener: { sessionStorage: parent } };
  initializeTabSession(popup);
  assert.equal(readSession(popup.sessionStorage), null);
  assert.equal(popup.opener, null);
  assert.equal(readSession(parent).role, 'treasurer');
  assert.equal(readAuthSession(storage({ token: 'bad', user: '{broken' })), null);
});
