import { chromium } from '../../client/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,reducedMotion:'reduce'});
await context.addInitScript(()=>{
 sessionStorage.setItem('token','isolated-visual-fixture');
 sessionStorage.setItem('user',JSON.stringify({name:'Preview Treasurer',role:'finance_officer',modules:['mortuary']}));
 sessionStorage.setItem('selectedModule',JSON.stringify({module:'mortuary',role:'finance_officer'}));
 localStorage.setItem('treasurerSidebarCollapsed','false');
});
const members=[...Array.from({length:32},(_,i)=>({id:`N1-${i}`,name:`Preview Member ${i}`,balance:800,barangay:'Poblacion',status:'active'})),...Array.from({length:18},(_,i)=>({id:`N2-${i}`,name:`Preview Member ${i}`,balance:500,barangay:'San Vicente',status:'active'})),...Array.from({length:6},(_,i)=>({id:`N3-${i}`,name:`Preview Member ${i}`,balance:-50,barangay:'San Roque',status:'active'}))];
let fixtureMembers=members;
const thresholds={targetBalance:1000,notice1Min:700,notice1Max:900,notice2Min:300,notice2Max:699};
const calls=[];const errors=[];let popups=0;
await context.route('**/api/**',async route=>{
 const request=route.request();calls.push({method:request.method(),url:request.url()});
 assert.equal(request.method(),'GET','No financial or batch operations in visual verification');
 const path=new URL(request.url()).pathname;
 let result={success:true,data:{}};
 if(path.endsWith('/balances/all'))result={success:true,data:{members:fixtureMembers,pagination:{total:fixtureMembers.length,totalPages:1}}};
 if(path.endsWith('/notice-thresholds'))result={success:true,data:thresholds};
 if(path.endsWith('/contributions'))result={success:true,data:[],pagination:{totalPages:1}};
 if(path.endsWith('/claims/pending-deduction'))result={success:true,data:[],pagination:{total:0,totalPages:1}};
 await route.fulfill({json:result,headers:{'Access-Control-Allow-Origin':'*'}});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});page.on('popup',()=>popups++);
async function open(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=notices');await page.getByRole('heading',{name:'Notices',exact:true}).waitFor();await page.locator('.tn-notice-row').first().waitFor();}
async function shot(name){await page.screenshot({path:`design-previews/notices/${name}.png`,fullPage:true,animations:'disabled'});}
await open();await shot('desktop');assert.match(await page.locator('.tn-footer').innerText(),/Showing 56 eligible members/);
const downloadButtons=page.locator('.tn-actions .tn-primary');const printButtons=page.locator('.tn-print');
const alignment=[];
for(let i=0;i<3;i++){const d=await downloadButtons.nth(i).boundingBox();const p=await printButtons.nth(i).boundingBox();alignment.push({download:d,print:p});assert.ok(Math.abs(d.y-p.y)<1);assert.ok(Math.abs(d.height-p.height)<1);if(i){assert.ok(Math.abs(d.x-alignment[0].download.x)<1);assert.ok(Math.abs(p.x-alignment[0].print.x)<1);}}
await page.getByRole('button',{name:'Download Notice 1 PDF for 32 members',exact:true}).click();await page.getByRole('heading',{name:'Download notice PDF?',exact:true}).waitFor();await shot('download-confirmation');await page.getByRole('button',{name:'Cancel',exact:true}).click();
await page.getByRole('button',{name:'Print Notice 1 for 32 members',exact:true}).click();await page.getByRole('heading',{name:'Print member notices?',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(popups,0);
await page.getByLabel('Barangay for notices',{exact:true}).selectOption('Poblacion');assert.equal(await page.getByRole('button',{name:'Download Notice 2 PDF for 0 members',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Print Final Notice for 0 members',exact:true}).isDisabled(),true);assert.match(await page.locator('.tn-footer').innerText(),/32 eligible members in Poblacion/);await shot('filtered');
await page.getByLabel('Barangay for notices',{exact:true}).selectOption('All');
const count=calls.length;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.treasurer-notices')?.getAttribute('aria-busy')==='false');assert.ok(calls.length>count);
for(const [width,height] of [[834,1194],[390,844],[320,740],[1366,700]]){
 await page.setViewportSize({width,height});await open();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow ${width}`);
 assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`main overflow ${width}`);
 await shot(`viewport-${width}`);
 await page.getByRole('button',{name:'Download Final Notice PDF for 6 members',exact:true}).scrollIntoViewIfNeeded();await shot(`actions-${width}`);
 for(const button of await page.locator('.tn-actions button').all()){const box=await button.boundingBox();assert.ok(box.width>=44&&box.height>=44);assert.ok(box.x>=0&&box.x+box.width<=width+1);}
 await page.locator('.mt-main').evaluate(el=>el.scrollTop=el.scrollHeight);await shot(`scrolled-${width}`);
}
thresholds.notice1Min=750;thresholds.notice1Max=950;thresholds.notice2Min=400;thresholds.notice2Max=749;
await open();assert.match(await page.locator('.tn-range').first().innerText(),/₱750 – ₱950/);
fixtureMembers=[];await open();assert.match(await page.locator('.tn-footer').innerText(),/Showing 0 eligible members/);assert.equal(await page.locator('.tn-actions button:disabled').count(),6);await shot('empty');
assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',errors,popups,alignment,checks:'counts, barangay filter, disabled zero counts, configured ranges, confirmation cancellation, refresh, responsive layout, action alignment and touch targets',api:'intercepted GET fixtures only'}));await browser.close();
