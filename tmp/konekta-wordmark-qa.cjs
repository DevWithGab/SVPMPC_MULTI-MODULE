const {chromium} = require('../client/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const page = await browser.newPage();
 for (const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.selector-wordmark-name').waitFor();
  const result = await page.evaluate(() => {
   const wordmark = document.querySelector('.selector-wordmark').getBoundingClientRect();
   const about = document.querySelector('.selector-about').getBoundingClientRect();
   return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:wordmark.right>about.left,text:document.querySelector('.selector-wordmark').innerText};
  });
  if(result.overflow || result.overlap) throw new Error(JSON.stringify({width,...result}));
  console.log(JSON.stringify({width,...result}));
  if(width===1440) await page.locator('.selector-topbar').screenshot({path:'tmp/konekta-wordmark.png'});
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
