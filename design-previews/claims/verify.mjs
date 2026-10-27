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
const claims=[['Antonio Mendoza','Rosa Mendoza','12','20'],['Lourdes Reyes','Marco Reyes','15','21'],['Pedro Santos','Ana Santos','17','23'],['Teresa Cruz','Luis Cruz','18','24']].map(([memberName,beneficiaryName,death,approved],i)=>({claimId:`CLM-2026-04${i+1}`,memberName,beneficiaryName,dateOfDeath:`2026-10-${death}T00:00:00Z`,approval:{approvedAt:`2026-10-${approved}T00:00:00Z`}}));
let failQueue=false;const writes=[];const errors=[];const previews=[];
await context.route('**/api/**',async route=>{
 const req=route.request();const url=new URL(req.url());const path=url.pathname;
 if(req.method()==='POST'){
  if(!path.endsWith('/deduction-batch/preview')){writes.push(path);await route.abort();return;}
  const selected=req.postDataJSON().claimIds;previews.push(selected);const selectedClaims=claims.filter(claim=>selected.includes(claim.claimId));
  await route.fulfill({json:{success:true,data:{claimCount:selected.length,ratePerClaim:50,amountPerMember:selected.length*50,membersCharged:128,collectedPerClaim:6400,totalCollected:selected.length*6400,membersGoingNegative:2,claims:selectedClaims}}});return;
 }
 assert.equal(req.method(),'GET');let result={success:true,data:{}};
 if(path.endsWith('/claims/pending-deduction')){
  if(failQueue){await route.fulfill({status:503,json:{success:false}});return;}
  const search=(url.searchParams.get('search')||'').toLowerCase();const rows=claims.filter(c=>`${c.claimId} ${c.memberName} ${c.beneficiaryName}`.toLowerCase().includes(search));result={success:true,data:rows,pagination:{total:rows.length,totalPages:1}};
 }
 if(path.endsWith('/deduction-rate'))result={success:true,data:{amount:50}};
 if(path.endsWith('/claims/deduction-summary'))result={success:true,data:[],totals:{batchCount:0,claimCount:0,totalCollected:0}};
 if(path.endsWith('/balances/all'))result={success:true,data:{members:[],pagination:{total:0,totalPages:1}}};
 if(path.endsWith('/contributions'))result={success:true,data:[],pagination:{totalPages:1}};
 await route.fulfill({json:result,headers:{'Access-Control-Allow-Origin':'*'}});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function open(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=claims');await page.getByRole('heading',{name:'Approved claims',exact:true}).waitFor();await page.locator('.mc-claim-queue tbody tr').first().waitFor();}
async function shot(name){await page.screenshot({path:`design-previews/claims/${name}.png`,fullPage:true,animations:'disabled'});}
const check=i=>page.getByRole('checkbox',{name:`Select claim ${claims[i].claimId} for ${claims[i].memberName}`,exact:true});
async function selectTwo(){await check(0).check();await check(1).check();}
await open();assert.equal(await page.getByRole('button',{name:'Review deduction',exact:true}).isDisabled(),true);await shot('unselected');
await selectTwo();assert.equal(await page.getByRole('checkbox',{name:'Select all claims on this page',exact:true}).evaluate(el=>el.indeterminate),true);assert.match(await page.locator('.mc-selection').innerText(),/100\.00/);await shot('desktop');
await page.getByRole('button',{name:'Review deduction (2)',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('button',{name:'Review summary',exact:true}).isDisabled(),true);await page.locator('#deduction-jv').fill('JV-PREVIEW');await page.getByRole('button',{name:'Review summary',exact:true}).click();await page.getByRole('heading',{name:'Confirm deduction',exact:true}).waitFor();assert.match(await page.getByRole('dialog').innerText(),/12,800\.00/);assert.match(await page.getByRole('dialog').innerText(),/2 members/);await shot('confirmation');await page.getByRole('button',{name:'Close dialog',exact:true}).click();assert.equal(writes.length,0);
await page.getByRole('textbox',{name:'Search by member, beneficiary or claim ID',exact:true}).fill('Pedro');await page.getByText('CLM-2026-043',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.mc-claim-queue tbody tr').length===1);assert.match(await page.locator('.mc-selection').innerText(),/2 claims selected/);await page.getByRole('button',{name:'Clear search',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.mc-claim-queue tbody tr').length===4);
await page.getByRole('checkbox',{name:'Select all claims on this page',exact:true}).check();assert.equal(await page.locator('.mc-claim-queue tbody input:checked').count(),4);await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.equal(await page.locator('.mc-claim-queue tbody input:checked').count(),0);
await page.getByRole('button',{name:'Deduction Summary',exact:true}).click();await page.getByRole('heading',{name:'Deduction Summary',exact:true}).waitFor();await shot('summary');await page.getByRole('button',{name:/Pending Deduction/}).click();await page.locator('.mc-claim-queue tbody tr').first().waitFor();
for(const [width,height] of [[834,1194],[390,844],[320,740],[1366,700]]){
 await page.setViewportSize({width,height});await open();await selectTwo();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow ${width}`);assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`main overflow ${width}`);
 await shot(`viewport-${width}`);await page.getByRole('button',{name:'Review deduction (2)',exact:true}).scrollIntoViewIfNeeded();await shot(`actions-${width}`);
 await page.getByRole('button',{name:'Review deduction (2)',exact:true}).click();await page.getByRole('dialog').waitFor();await shot(`dialog-${width}`);
 const box=await page.getByRole('dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
}
await page.getByRole('textbox',{name:'Search by member, beneficiary or claim ID',exact:true}).fill('nonexistent');await page.getByRole('heading',{name:'No matching claims',exact:true}).waitFor();await shot('empty-search');
assert.equal(writes.length,0);assert.deepEqual(errors,[]);assert.deepEqual(previews[0],[claims[0].claimId,claims[1].claimId]);console.log(JSON.stringify({result:'passed',errors,writes,checks:'selection, partial select-all, search selection persistence, clear, review reference/impact, cancellation, summary tab, phone layout/dialog containment',api:'isolated fixtures; final deduction endpoint never called'}));await browser.close();
