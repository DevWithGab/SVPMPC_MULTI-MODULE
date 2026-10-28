const {chromium}=require('../client/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:5173/super-admin');
  const password=page.getByLabel('Super Admin Password',{exact:true});
  await password.fill('sample-password');
  await page.getByRole('button',{name:'Show password',exact:true}).click();
  if(await password.getAttribute('type')!=='text'||await password.inputValue()!=='sample-password')throw new Error('Show password failed');
  await page.getByRole('button',{name:'Hide password',exact:true}).click();
  if(await password.getAttribute('type')!=='password')throw new Error('Hide password failed');
  await password.fill('');
  const image=await page.evaluate(()=>{
   const header=document.querySelector('[style*="building-coop"]');
   return {background:getComputedStyle(header).backgroundImage,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  if(!image.background.includes('building-coop.png')||image.overflow)throw new Error(JSON.stringify(image));
  const response=await page.request.get('http://127.0.0.1:5173/images/backgrounds/building-coop.png');
  if(!response.ok())throw new Error('Building image did not load');
  await page.waitForTimeout(350);
  await page.screenshot({path:`tmp/super-admin-login-${width}.png`});
  console.log(JSON.stringify({width,passwordToggle:'passed',background:'passed',overflow:false}));
 }
 await browser.close();if(errors.length)throw new Error(errors.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1});
