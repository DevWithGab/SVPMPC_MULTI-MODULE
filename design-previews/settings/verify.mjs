import { chromium } from '../../client/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,channel:'msedge'});
const context = await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,reducedMotion:'reduce'});
await context.addInitScript(()=>{if(window.top!==window)return;sessionStorage.setItem('token','isolated-visual-fixture');sessionStorage.setItem('user',JSON.stringify({name:'Preview Treasurer',role:'finance_officer',modules:['mortuary']}));sessionStorage.setItem('selectedModule',JSON.stringify({module:'mortuary',role:'finance_officer'}));localStorage.setItem('treasurerSidebarCollapsed','false');});
let rate={settingId:3,amount:50,effectiveDate:'2026-10-01',description:'Standard mortuary assessment.',status:'active',createdBy:'Maria Dela Cruz'};
let history=[rate,{settingId:2,amount:40,effectiveDate:'2026-07-01',status:'superseded',createdBy:'Maria Dela Cruz'},{settingId:1,amount:25,effectiveDate:'2026-01-01',status:'superseded',createdBy:'Juan Reyes'}];
let thresholds={settingId:3,targetBalance:1000,notice1Min:700,notice1Max:900,notice2Min:300,notice2Max:699,effectiveDate:'2026-10-01',status:'active',createdBy:'Maria Dela Cruz',description:'Standard notice balance ranges.',noticeManagerName:'Maria Dela Cruz'};
let loading=false, failed=false;const writes=[],errors=[];
await context.route('**/api/**',async route=>{
 const request=route.request();const path=new URL(request.url()).pathname;
 let data={success:true,data:{}};
 if(path.includes('/settings/')){
  if(loading)await new Promise(resolve=>setTimeout(resolve,700));
  if(failed){await route.fulfill({status:500,json:{message:'Unable to load settings preview.'}});return;}
  if(request.method()==='POST'){
   const payload=request.postDataJSON();writes.push({path,payload});
   if(path.endsWith('deduction-rate')){rate={...rate,...payload};history=[rate,...history.map(row=>({...row,status:'superseded'}))];}
   else thresholds={...thresholds,...payload};
  }
  if(path.endsWith('deduction-rate/current'))data={success:true,data:rate};
  else if(path.endsWith('deduction-rate')){const page=Number(new URL(request.url()).searchParams.get('page')||1);data={success:true,data:history.slice((page-1)*100,page*100),pagination:{total:history.length,totalPages:Math.ceil(history.length/100)}};}
  else if(path.endsWith('notice-thresholds/current'))data={success:true,data:thresholds};
  else data={success:true,data:[thresholds,{...thresholds,settingId:2,status:'superseded',createdBy:'Juan Reyes',effectiveDate:'2026-07-01'}],pagination:{total:2,totalPages:1}};
 }
 if(path.endsWith('/claims/pending-deduction'))data={success:true,data:[],pagination:{total:0,totalPages:1}};
 if(path.endsWith('/contributions'))data={success:true,data:[],pagination:{total:0,totalPages:1}};
 if(path.endsWith('/balances/all'))data={success:true,data:{members:[],pagination:{total:0,totalPages:1}}};
 await route.fulfill({json:data});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function shot(name){await page.screenshot({path:`design-previews/settings/${name}.png`,fullPage:true,animations:'disabled'});}
async function section(name){await page.getByRole('button',{name,exact:true}).click();await page.locator('.fs-loading').waitFor({state:'hidden'});}
async function open(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=settings');await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();await page.locator('.fs-loading').waitFor({state:'hidden'});}
async function fits(label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`document overflow ${label}`);assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`main overflow ${label}`);}
await open();assert.equal(await page.locator('.fs-history tbody tr').count(),3);await shot('desktop');
await page.getByRole('button',{name:'Update Rate',exact:true}).click();await page.getByRole('dialog',{name:'Update Deduction Rate',exact:true}).waitFor();await shot('rate-modal');
await page.locator('#deduction-rate-amount').fill('0');await page.getByRole('button',{name:'Save New Rate',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(writes.length,0);
await page.locator('#deduction-rate-amount').fill('1000.50');assert.equal(await page.locator('#deduction-rate-amount').inputValue(),'1,000.50');await page.getByRole('button',{name:'Save New Rate',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.locator('.fs-loading').waitFor({state:'hidden'});assert.equal(writes[0].payload.amount,1000.5);assert.match(await page.locator('.fs-value').innerText(),/1,000.5/);
await section('Notice thresholds');await shot('thresholds');await page.getByRole('button',{name:'Update Thresholds',exact:true}).click();await page.getByRole('dialog').waitFor();await shot('threshold-modal');
const target=page.getByLabel(/Target Balance/);await target.fill('0');await page.getByRole('button',{name:'Save New Thresholds',exact:true}).click();await page.getByText('Target balance must be greater than 0.',{exact:true}).waitFor();assert.equal(writes.length,1);await target.fill('1200');await page.getByRole('button',{name:'Save New Thresholds',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(writes[1].payload.targetBalance,1200);
await section('Notice content');await shot('content');assert.ok(await page.getByRole('button',{name:'Save Manager Name',exact:true}).isDisabled());await page.getByLabel('Manager name',{exact:true}).fill('Preview Manager');await page.getByRole('button',{name:'Save Manager Name',exact:true}).click();await page.getByText('Manager name saved for all notices.',{exact:true}).waitFor();assert.equal(writes[2].payload.noticeManagerName,'Preview Manager');
await page.getByRole('button',{name:'Edit Content',exact:true}).first().click();await page.getByRole('dialog').waitFor();await shot('content-editor');await page.getByRole('button',{name:'Preview notice',exact:true}).click();await page.getByTitle('Notice preview with sample member details').waitFor();await shot('notice-preview');await page.getByRole('button',{name:'Back to editing',exact:true}).click();const message=page.getByLabel('Notice message',{exact:false});const originalMessage=await message.inputValue();await message.fill('Missing fields');await page.getByRole('button',{name:'Save Content',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(writes.length,3);await message.fill(originalMessage+'\n\nPlease contact the cooperative for assistance.');await page.getByRole('button',{name:'Save Content',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.match(writes[3].payload.noticeMessageTemplate,/Please contact/);await page.getByRole('button',{name:'Edit Content',exact:true}).last().click();await page.getByRole('dialog',{name:'Edit Final Notice Content',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
for(const [width,height] of [[834,1194],[390,844],[320,740],[1366,700]]){
 await page.setViewportSize({width,height});await section('Deduction rate');await fits(`rate ${width}`);await page.locator('.fs-page-heading').scrollIntoViewIfNeeded();await shot(`rate-${width}`);
 await page.getByRole('button',{name:'Update Rate',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await shot(`modal-${width}`);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await section('Notice thresholds');await fits(`thresholds ${width}`);await shot(`thresholds-${width}`);await page.getByRole('button',{name:'Update Thresholds',exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await shot(`threshold-modal-${width}`);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await section('Notice content');await fits(`content ${width}`);await shot(`content-${width}`);await page.getByRole('button',{name:'Edit Content',exact:true}).first().click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await shot(`editor-${width}`);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
}
await page.setViewportSize({width:1487,height:1058});history=Array.from({length:105},(_,i)=>({...rate,settingId:i,createdBy:`User ${i}`}));await open();assert.equal(await page.locator('.fs-history tbody tr').count(),100);await page.getByRole('button',{name:'Next page',exact:true}).click();await page.locator('.fs-loading').waitFor({state:'hidden'});assert.equal(await page.locator('.fs-history tbody tr').count(),5);
history=[];await open();await page.getByText('No rate history yet.',{exact:true}).waitFor();await shot('empty');loading=true;const navigate=page.goto('http://localhost:5173/mortuary/finance_officer?tab=settings');await page.getByRole('status',{name:'Loading settings'}).waitFor();await shot('loading');await navigate;await page.locator('.fs-loading').waitFor({state:'hidden'});loading=false;
failed=true;await open();await page.getByText('Unable to load settings preview.',{exact:true}).waitFor();await shot('error');await section('Notice content');await page.getByRole('alert').waitFor();failed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByLabel('Manager name',{exact:true}).waitFor();assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'passed',errors,isolatedWrites:writes.length,checks:'all three sections, rate/threshold validation and mocked saves, manager form, notice editor/preview/placeholder validation, pagination, loading/empty/error/retry, responsive containment and dialogs'}));await browser.close();
