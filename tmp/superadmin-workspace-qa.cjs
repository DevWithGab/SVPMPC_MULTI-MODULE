const { chromium } = require('../client/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    sessionStorage.setItem('token', 'isolated-preview');
    sessionStorage.setItem('user', JSON.stringify({ role: 'super_admin', fullName: 'Preview Admin', modules: ['attendance', 'mortuary'] }));
  });
  const logs = [{ _id: 'log-1', timestamp: '2026-10-29T08:00:00Z', userName: 'Super Admin', userRole: 'super_admin', action: 'staff_created', entityName: 'Maria Santos', entityType: 'staff', status: 'success', description: 'Staff account created', module: 'admin' }];
  await context.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') throw new Error('Unexpected mutation during preview');
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith('/admin/members')) data = { members: [{ memberId: '000123', memberName: 'Juan Dela Cruz', email: 'juan@example.com', phoneNumber: '09123456789', barangay: 'San Vicente', status: 'active', modules: ['attendance', 'mortuary'] }], counts: { total: 1248, active: 1180, inactive: 42, deceased: 26 }, pagination: { total: 1 }, barangays: ['San Vicente'] };
    else if (url.pathname.endsWith('/admin/staff')) data = { users: [{ userId: 'staff-1', fullName: 'Maria Santos', username: 'maria.santos', email: 'maria@example.com', role: 'secretary', modules: ['attendance'], status: 'active' }] };
    else if (url.pathname.includes('/audit/logs')) data = { logs, pagination: { page: 1, total: 1, pages: 1, totalPages: 1 } };
    else data = { datasets: [], counts: {}, collections: {} };
    await route.fulfill({ json: data });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  fs.mkdirSync('design-previews/superadmin', { recursive: true });
  for (const width of [1440, 834, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of ['members', 'staff', 'auditlogs', 'mortuary-audit', 'mortuary-backup', 'attendance-audit', 'attendance-backup']) {
      await page.goto(`http://127.0.0.1:5173/super-admin?tab=${tab}`);
      await page.locator('.sam-main').waitFor();
      await page.waitForTimeout(200);
      const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, title: document.querySelector('main h1')?.textContent }));
      checks.push({ width, tab, ...result });
      if (width === 1440 || width === 390) await page.screenshot({ path: `design-previews/superadmin/${tab}-${width}.png`, fullPage: true });
    }
  }
  await page.locator('.sam-mobile-navigation').click();
  await page.getByRole('button', { name: 'Staff Audit Logs', exact: true }).click();
  if (await page.locator('.sam-mobile-navigation').getAttribute('aria-expanded') !== 'false') throw new Error('Mobile navigation did not close');
  await page.locator('.sam-staff-audit').waitFor();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  fs.writeFileSync('design-previews/superadmin/checks.json', JSON.stringify({ checks, errors, mobileNavigation: 'passed', auditDetails: 'passed' }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
  await browser.close();
  if (errors.length || checks.some(check => check.overflow || !check.title)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
