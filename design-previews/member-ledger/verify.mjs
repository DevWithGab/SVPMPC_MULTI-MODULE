import { chromium } from '../../client/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,reducedMotion:'reduce'});
await context.addInitScript(()=>{sessionStorage.setItem('token','isolated-visual-fixture');sessionStorage.setItem('user',JSON.stringify({name:'Preview Treasurer',role:'finance_officer',modules:['mortuary']}));sessionStorage.setItem('selectedModule',JSON.stringify({module:'mortuary',role:'finance_officer'}));localStorage.setItem('treasurerSidebarCollapsed','false');});
const members=[['000124','Elena Ramos',-250,'San Jose'],['000087','Roberto Cruz',150,'Poblacion'],['000031','Maria Santos',350,'San Isidro'],['000056','Jose Reyes',750,'San Jose'],['000109','Linda Garcia',1200,'Poblacion']].map(([id,name,balance,barangay])=>({id,name,balance,barangay,address:`${barangay}, Dupax del Sur, Nueva Vizcaya`,beneficiaries:'Carlo Ramos',status:'active'}));
const entries=[{id:'OPEN',date:'2026-10-01',ref_no:'OR-2026-1001',received:1000,withdrawn:0,balance:1000,canCorrect:true},...[[8,300,700],[15,400,300],[21,500,-200],[26,50,-250]].map(([day,withdrawn,balance])=>({id:`JV-${day}`,date:`2026-10-${String(day).padStart(2,'0')}`,ref_no:`JV-2026-10${String(day).padStart(2,'0')}`,received:0,withdrawn,balance}))];
let fixtureMembers=members;const errors=[];const writes=[];let getCalls=0;
await context.route('**/api/**',async route=>{
 const request=route.request();const url=new URL(request.url());const path=url.pathname;
 if(request.method()!=='GET'){writes.push(path);await route.abort();return;}getCalls++;
 let data={success:true,data:{}};
 if(path.endsWith('/balances/all')){let rows=fixtureMembers;if(url.searchParams.has('page')){const search=(url.searchParams.get('search')||'').toLowerCase();const barangay=url.searchParams.get('barangay');rows=rows.filter(m=>(!search||`${m.id} ${m.name}`.toLowerCase().includes(search))&&(!barangay||barangay==='All'||m.barangay===barangay));const total=rows.length;const page=Number(url.searchParams.get('page')||1);rows=rows.slice((page-1)*100,page*100);data={success:true,data:{members:rows,pagination:{total,totalPages:Math.max(1,Math.ceil(total/100))}}};}else data={success:true,data:{members:rows}};}
 if(path.endsWith('/ledger/000124'))data={success:true,data:entries,pagination:{totalPages:1}};
 if(path.endsWith('/ledger/daily-summary'))data={success:true,data:{date:url.searchParams.get('date'),rows:[],totals:{totalAdded:0,members:0,transactions:0,pendingEdits:0}}};
 if(path.endsWith('/notice-thresholds'))data={success:true,data:{targetBalance:1000,notice1Min:700,notice1Max:900,notice2Min:300,notice2Max:699}};
 if(path.endsWith('/contributions'))data={success:true,data:[],pagination:{totalPages:1}};
 if(path.endsWith('/claims/pending-deduction'))data={success:true,data:[],pagination:{total:0,totalPages:1}};
 await route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function directory(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=ledger');await page.getByRole('heading',{name:'Member ledgers',exact:true}).waitFor();await page.getByRole('button',{name:'Open ledger for Elena Ramos',exact:true}).waitFor();}
async function individual(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=ledger&member=000124');await page.getByRole('heading',{name:'Member ledger',exact:true}).waitFor();await page.getByRole('button',{name:'Edit amount',exact:true}).waitFor();}
async function shot(name){await page.screenshot({path:`design-previews/member-ledger/${name}.png`,fullPage:true,animations:'disabled'});}
const rows=()=>page.locator('.ml-directory tbody tr');
await directory();await shot('directory-desktop');assert.equal(await rows().count(),5);
await page.getByLabel('Name or passbook number',{exact:true}).fill('Elena');await page.waitForFunction(()=>document.querySelectorAll('.ml-directory tbody tr').length===1);
await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ml-directory tbody tr').length===5);
await page.getByLabel('Barangay',{exact:true}).selectOption('San Jose');await page.waitForFunction(()=>document.querySelectorAll('.ml-directory tbody tr').length===2);await page.getByRole('button',{name:'Reset filters',exact:true}).click();
await page.getByRole('button',{name:'Bulk upload CSV',exact:true}).click();await page.getByRole('dialog').waitFor();await shot('upload-dialog');await page.getByRole('button',{name:'Close upload dialog',exact:true}).click();
await page.getByRole('button',{name:'Daily Summary',exact:true}).click();await page.getByRole('heading',{name:'Daily summary',exact:true}).waitFor();await page.getByText('No amounts added on this date. Choose another date to view entries.',{exact:true}).waitFor();await page.getByRole('button',{name:'Member Register',exact:true}).click();
await page.setViewportSize({width:1485,height:1059});await page.getByRole('button',{name:'Open ledger for Elena Ramos',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('member')==='000124');await page.getByRole('button',{name:'Edit amount',exact:true}).waitFor();await shot('individual-desktop');
assert.match(await page.locator('.ml-summary').innerText(),/1,000\.00/);assert.match(await page.locator('.ml-summary').innerText(),/1,250\.00/);
await page.getByText('More',{exact:true}).click();await page.getByRole('button',{name:'Export Ledger CSV',exact:true}).waitFor();await shot('more-menu');await page.getByText('More',{exact:true}).click();
await page.getByText('Notice options',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Print Final Notice',exact:true}).isEnabled(),true);await shot('notice-menu');await page.getByText('Notice options',{exact:true}).click();
await page.getByLabel('Transaction type',{exact:true}).selectOption('deposits');assert.match(await page.locator('.ml-summary').innerText(),/1 entry shown/);await page.getByLabel('Transaction type',{exact:true}).selectOption('withdrawals');assert.match(await page.locator('.ml-summary').innerText(),/4 entries shown/);
await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByLabel('Sort by date',{exact:true}).selectOption('asc');assert.match(await page.locator('[aria-label="Member transaction history"] tbody tr').nth(1).innerText(),/01 Oct 2026/);
await page.getByLabel('Date range',{exact:true}).selectOption('lastMonth');await page.getByText('No transactions found.',{exact:true}).waitFor();await page.getByRole('button',{name:'Reset filters',exact:true}).click();
await page.getByRole('button',{name:'Edit amount',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByLabel('New amount').fill('900');await page.getByRole('button',{name:'Review change',exact:true}).click();assert.match(await page.getByRole('dialog').innerText(),/350\.00/);await shot('edit-review');await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(writes.length,0);
await page.emulateMedia({media:'print'});assert.equal(await page.locator('.ml-top-actions').evaluate(el=>getComputedStyle(el).display==='none'||getComputedStyle(el.closest('.ml-screen')).display==='none'),true);assert.equal(await page.locator('.ml-member-barangay').evaluate(el=>getComputedStyle(el).display),'none');await page.emulateMedia({media:'screen'});
await page.getByRole('button',{name:'Back to list',exact:true}).click();await page.waitForURL(url=>!url.searchParams.has('member'));
for(const [width,height] of [[834,1194],[390,844],[320,740],[1366,700]]){
 await page.setViewportSize({width,height});await directory();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await shot(`directory-${width}`);
 await individual();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`individual page overflow ${width}`);assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`individual main overflow ${width}`);await shot(`individual-${width}`);
 await page.getByText('More',{exact:true}).click();const more=await page.locator('.ml-menu-items').boundingBox();assert.ok(more.x>=0&&more.x+more.width<=width+1,`more menu ${width}`);await shot(`more-${width}`);await page.getByText('More',{exact:true}).click();
 await page.getByText('Notice options',{exact:true}).click();const notice=await page.locator('.ml-notice-menu .ml-actions').boundingBox();assert.ok(notice.x>=0&&notice.x+notice.width<=width+1,`notice menu ${width}`);await shot(`notice-${width}`);await page.getByText('Notice options',{exact:true}).click();
 await page.getByRole('button',{name:'Edit amount',exact:true}).scrollIntoViewIfNeeded();await shot(`history-${width}`);
 await page.getByRole('button',{name:'Edit amount',exact:true}).click();await page.getByRole('dialog').waitFor();const dialog=await page.getByRole('dialog').boundingBox();assert.ok(dialog.x>=0&&dialog.x+dialog.width<=width+1);await shot(`edit-${width}`);await page.getByRole('button',{name:'Close',exact:true}).click();
}
fixtureMembers=[...members,...Array.from({length:100},(_,i)=>({id:`SAMPLE-${i}`,name:`Sample Member ${i}`,balance:1000,barangay:'Poblacion',status:'active'}))];
await directory();await page.waitForFunction(()=>document.querySelectorAll('.ml-directory tbody tr').length===100);
await page.getByRole('button',{name:'Next page',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ml-directory tbody tr').length===5);
assert.deepEqual(errors,[]);assert.equal(writes.length,0);console.log(JSON.stringify({result:'passed',errors,writes,getCalls,checks:'directory search/barangay, daily summary, upload dialog, individual navigation, filters/sort, menus, totals, correction review cancellation, responsive/menu/dialog containment, print-hidden controls'}));await browser.close();
