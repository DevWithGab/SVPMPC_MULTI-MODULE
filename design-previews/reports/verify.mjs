import { chromium } from '../../client/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,reducedMotion:'reduce',acceptDownloads:true});
await context.addInitScript(()=>{sessionStorage.setItem('token','isolated-visual-fixture');sessionStorage.setItem('user',JSON.stringify({name:'Preview Treasurer',role:'finance_officer',modules:['mortuary']}));sessionStorage.setItem('selectedModule',JSON.stringify({module:'mortuary',role:'finance_officer'}));localStorage.setItem('treasurerSidebarCollapsed','false');});
const members=[['001','Elena Ramos',-250,'San Jose','active'],['002','Roberto Cruz',-50,'Poblacion','inactive'],['003','Maria Santos',350,'San Isidro','active'],['004','Jose Reyes',750,'San Jose','active'],['005','Linda Garcia',1200,'Poblacion','active'],['006','Deceased Member',-1000,'San Jose','deceased']].map(([id,name,balance,barangay,status])=>({id,name,balance,barangay,status,join_date:'2020-01-01'}));
let contributions=[45000,38000,42000,35000].map((amount,i)=>({id:`PAY-${i}`,member_id:members[i].id,member_name:members[i].name,payment_date:`2026-${String(10-i).padStart(2,'0')}-15`,amount,status:'paid'}));
const claims=[12800,19200,6400,6400].map((totalCollected,i)=>({claimId:`CLAIM-${i}`,memberId:members[i].id,memberName:members[i].name,beneficiaryName:`Beneficiary ${i+1}`,dateFiled:`2026-${String(10-i).padStart(2,'0')}-05`,status:'deduction_processed',deduction:{totalCollected,processedAt:`2026-${String(10-i).padStart(2,'0')}-20`}}));
const errors=[];const writes=[];
await context.route('**/api/**',async route=>{
 const request=route.request();const url=new URL(request.url());const path=url.pathname;
 if(request.method()!=='GET'){writes.push(path);await route.abort();return;}
 let data={success:true,data:{}};
 if(path.endsWith('/balances/all'))data={success:true,data:{members,pagination:{total:members.length,totalPages:1}}};
 if(path.endsWith('/contributions')){const page=Number(url.searchParams.get('page')||1);data={success:true,data:contributions.slice((page-1)*100,page*100),pagination:{total:contributions.length,totalPages:Math.max(1,Math.ceil(contributions.length/100))}};}
 if(path.endsWith('/treasurer/claims'))data={success:true,data:claims,pagination:{total:4,totalPages:1}};
 if(path.endsWith('/claims/pending-deduction'))data={success:true,data:[],pagination:{total:0,totalPages:1}};
 if(path.endsWith('/dashboard'))data={success:true,data:{fundBalance:115200,minimumBalance:1000}};
 await route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function open(){await page.goto('http://localhost:5173/mortuary/finance_officer?tab=reports');await page.getByRole('heading',{name:'Reports',exact:true}).waitFor();await page.getByRole('button',{name:'Export CSV',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.reports-export-actions button')?.disabled);}
async function choose(value){await page.getByLabel('Report type',{exact:true}).selectOption(value);}
async function shot(name){await page.screenshot({path:`design-previews/reports/${name}.png`,fullPage:true,animations:'disabled'});}
await open();assert.equal(await page.locator('#mortuary-report-type option').count(),6);await shot('desktop');
assert.match(await page.locator('.rp-summary-metrics').innerText(),/115,200\.00/);assert.match(await page.locator('.rp-summary-metrics').innerText(),/160,000\.00/);assert.match(await page.locator('.rp-summary-metrics').innerText(),/44,800\.00/);
assert.equal(await page.locator('.rp-period-section tbody tr').count(),4);assert.match(await page.locator('.rp-period-section tfoot').innerText(),/160,000\.00/);
await page.getByRole('button',{name:'Annual',exact:true}).click();assert.equal(await page.locator('.rp-period-section tbody tr').count(),1);assert.match(await page.locator('.rp-period-section tbody').innerText(),/2026/);await shot('annual');await page.getByRole('button',{name:'Monthly',exact:true}).click();
let download=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV',exact:true}).click()]);const csv=await readFile(await download[0].path(),'utf8');assert.match(csv,/Financial Summary/i);assert.match(csv,/160,000/);
download=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export PDF',exact:true}).click()]);const pdf=await readFile(await download[0].path());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
await choose('contributions');assert.equal(await page.locator('.reports-content tbody tr').count(),4);await page.getByLabel('Barangay',{exact:true}).selectOption('San Jose');assert.equal(await page.locator('.reports-content tbody tr').count(),2);await shot('contributions-filtered');await page.getByRole('button',{name:'Reset filter',exact:true}).click();
await choose('claims');await page.getByLabel('Month filed',{exact:true}).selectOption('2026-10');assert.equal(await page.locator('.reports-content tbody tr').count(),1);assert.match(await page.locator('.reports-content tfoot').innerText(),/12,800\.00/);await shot('deduction-report');await page.getByRole('button',{name:'Reset filter',exact:true}).click();
await choose('deceasedMembers');assert.equal(await page.locator('.reports-content tbody tr').count(),1);assert.match(await page.locator('.reports-content').innerText(),/Deceased Member/);await shot('deceased-members');
await choose('negativeBalances');assert.equal(await page.locator('.reports-content tbody tr').count(),2);assert.doesNotMatch(await page.locator('.reports-content tbody').innerText(),/Deceased Member/);await shot('negative-balances');await page.getByLabel('Barangay',{exact:true}).selectOption('San Isidro');await page.getByText('No members have a negative balance.',{exact:true}).waitFor();await shot('empty-filter');await page.getByRole('button',{name:'Reset filter',exact:true}).click();
await choose('memberStanding');assert.equal(await page.locator('.reports-content tbody tr').count(),4);assert.doesNotMatch(await page.locator('.reports-content tbody').innerText(),/Roberto Cruz|Deceased Member/);await shot('member-standing');
for(const [width,height] of [[834,1194],[390,844],[320,740],[1366,700]]){
 await page.setViewportSize({width,height});await choose('summary');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow ${width}`);assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`main overflow ${width}`);await shot(`summary-${width}`);
 await page.getByRole('button',{name:'Annual',exact:true}).scrollIntoViewIfNeeded();await shot(`periods-${width}`);await choose('claims');assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`claims overflow ${width}`);await page.locator('.reports-content').scrollIntoViewIfNeeded();await page.locator('.reports-content').evaluate(el=>el.scrollLeft=el.scrollWidth);await shot(`claims-${width}`);
}
contributions=Array.from({length:105},(_,i)=>({id:`PAY-${i}`,member_id:'001',member_name:`Sample Member ${i}`,payment_date:'2026-10-15',amount:100,status:'paid'}));await open();await choose('contributions');assert.equal(await page.locator('.reports-content tbody tr').count(),100);await page.getByRole('button',{name:'Next page',exact:true}).click();assert.equal(await page.locator('.reports-content tbody tr').count(),5);
download=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV',exact:true}).click()]);const full=await readFile(await download[0].path(),'utf8');assert.match(full,/Sample Member 0/);assert.match(full,/Sample Member 104/);
assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log(JSON.stringify({result:'passed',errors,writes,pdfBytes:pdf.length,checks:'six report types, monthly/annual, summary totals, barangay/month filters, active/deceased/negative scopes, CSV/PDF downloads, complete paginated export, responsive table containment'}));await browser.close();
