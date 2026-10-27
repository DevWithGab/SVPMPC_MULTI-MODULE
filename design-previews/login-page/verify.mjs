import { chromium } from '../../client/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,channel:'msedge'});
const page = await browser.newPage({viewport:{width:1487,height:1058}});
await page.route('**/api/auth/community-stats', route => route.fulfill({json:{totalMembers:120}}));
await page.route('**/api/auth/login', route => route.fulfill({status:401,json:{message:'Invalid credentials'}}));
await page.goto('http://localhost:5173/?module=mortuary');
await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
await page.waitForFunction(() => getComputedStyle(document.querySelector('.entry-login')).opacity === '1');
await page.screenshot({path:'design-previews/login-page/desktop.png',fullPage:true});
await page.getByLabel('Username',{exact:true}).fill('preview-user');
await page.getByLabel('Password',{exact:true}).fill('preview-password');
await page.getByRole('button',{name:'Show password',exact:true}).click();
assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'text');
await page.getByRole('button',{name:'Hide password',exact:true}).click();
assert.equal(await page.getByLabel('Password',{exact:true}).getAttribute('type'),'password');
await page.getByRole('button',{name:'Sign in',exact:true}).click();
await page.getByRole('alert').filter({hasText:'Invalid credentials'}).waitFor();
await page.getByRole('button',{name:'Back to System Selection'}).click();
await page.getByRole('heading',{name:'Where would you like to work?'}).waitFor();
await page.getByRole('button',{name:/Mortuary Services/}).click();
await page.goBack();
await page.getByRole('heading',{name:'Where would you like to work?'}).waitFor();
await page.goForward();
await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
for (const width of [834,390,320]) {
 await page.setViewportSize({width,height:width===834?1194:844});
 await page.goto('http://localhost:5173/?module=mortuary');
 await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);
 await page.waitForFunction(() => getComputedStyle(document.querySelector('.entry-login')).opacity === '1');
await page.screenshot({path:`design-previews/login-page/${width}.png`,fullPage:true});
}
for(const role of ['admin','secretary','scanner_operator']) {
 await page.goto(`http://localhost:5173/?module=attendance&role=${role}`);
 await page.getByRole('heading',{name:'Welcome back.'}).waitFor();
 await page.getByRole('button',{name:'Back to Role Selection'}).click();
 assert.equal(new URL(page.url()).search,'?module=attendance');
}
console.log('Passed: responsive widths, password toggle, mocked login error, module back/browser history, all attendance role back links.');
await browser.close();



