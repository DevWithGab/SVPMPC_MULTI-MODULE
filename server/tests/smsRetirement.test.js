const test = require('node:test');
const assert = require('node:assert/strict');

test('treasurer routes retain financial and historical endpoints without SMS send or retry', () => {
  const router = require('../modules/mortuary/routes/treasurerRoutes');
  const routes = router.stack.filter(layer => layer.route).map(layer => layer.route.path);
  for (const path of ['/contributions/record', '/contributions/bulk-upload', '/claims/:claimId/process-deduction', '/notices/:level/batch', '/notifications/history/:memberId']) {
    assert.ok(routes.includes(path), `Missing retained route: ${path}`);
  }
  assert.ok(!routes.includes('/balances/send-low-balance-notifications'));
  assert.ok(!routes.includes('/notifications/retry-failed'));
  const history = require('../modules/mortuary/services/thresholdNotificationService');
  assert.equal(history.checkAndNotify, undefined);
  assert.equal(history.retryFailedNotifications, undefined);
  assert.equal(typeof history.getNotificationHistory, 'function');
});
