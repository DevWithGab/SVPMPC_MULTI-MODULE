const test = require('node:test');
const assert = require('node:assert/strict');

test('treasurer routes retain financial and PDF notice endpoints without SMS endpoints', () => {
  const router = require('../modules/mortuary/routes/treasurerRoutes');
  const routes = router.stack.filter(layer => layer.route).map(layer => layer.route.path);
  for (const path of ['/contributions/record', '/contributions/bulk-upload', '/claims/deduction-batch', '/notices/:level/batch', '/notices/batch/:jobId', '/notices/batch/:jobId/download']) {
    assert.ok(routes.includes(path), `Missing retained route: ${path}`);
  }
  assert.ok(!routes.includes('/balances/send-low-balance-notifications'));
  assert.ok(!routes.some(path => path.startsWith('/notifications/')));
});
