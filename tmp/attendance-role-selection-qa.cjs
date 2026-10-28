const { chromium } = require('../client/node_modules/playwright');
const fs = require('fs');
(async () => {
 const browser = await chromium.launch({headless: true, channel: "msedge"});
 const page = await browser.newPage({reducedMotion: 'reduce'});
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 const checks = [];
 fs.mkdirSync('design-previews/attendance', {recursive: true});
 for (const width of [1440, 834, 390, 320]) {
  await page.setViewportSize({width, height: 1000});
  await page.goto('http://127.0.0.1:5173/?module=attendance');
  await page.getByRole('heading', {name: 'Select your role'}).waitFor();
  await page.locator('.entry-role-selection').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  await page.waitForTimeout(300);
  await page.screenshot({path: `design-previews/attendance/role-selection-${width}.png`, fullPage: true});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error(`Overflow at ${width}`);
  checks.push({width, overflow});
 }
 for (const [label, role] of [['Secretary', 'secretary'], ['Scanner Operator', 'scanner_operator'], ['Admin', 'admin']]) {
  await page.goto('http://127.0.0.1:5173/?module=attendance');
  await page.getByRole('button', {name: new RegExp('^' + label)}).click();
  await page.waitForURL(`**/?module=attendance&role=${role}`);
  await page.locator('input').first().waitFor();
  await page.getByRole('button', {name: /Back/}).click();
  await page.getByRole('heading', {name: 'Select your role'}).waitFor();
  checks.push({role, navigation: 'passed'});
 }
 await page.getByRole('button', {name: 'Back to modules'}).click();
 await page.getByRole('heading', {name: 'Choose a module'}).waitFor();
 if (errors.length) throw new Error(errors.join('\n'));
 console.log(JSON.stringify({checks, backToModules: 'passed', errors}, null, 2));
 await browser.close();
})().catch(e => {console.error(e);process.exitCode = 1;});


