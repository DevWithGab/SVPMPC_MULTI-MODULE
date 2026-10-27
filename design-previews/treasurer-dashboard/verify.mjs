import { chromium } from '../../client/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,channel:'msedge'});
const context = await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,reducedMotion:'reduce'});
const page = await context.newPage();
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
page.on('console', message=>{if(message.type()==='error')errors.push(message.text());});
const stats={fundBalance:115200,activeMembers:128,totalMembers:148,lowBalanceMembers:24,minimumBalance:1000,totalDeductionsCollected:18000,memberStanding:{excellent:20,good:40,fair:44,atRisk:18,negativeBalance:6},statusComposition:{active:128,inactive:12,deceased:8}};
const contributions=[35000,42000,38000,45000].map((amount,index)=>({amount,status:'paid',payment_date:`2026-${String(index+7).padStart(2,'0')}-01`}));
await context.addInitScript(()=>{
 sessionStorage.setItem('token','isolated-visual-fixture');
 sessionStorage.setItem('user',JSON.stringify({name:'Preview Treasurer',role:'finance_officer',modules:['mortuary']}));
 sessionStorage.setItem('selectedModule',JSON.stringify({module:'mortuary',role:'finance_officer'}));
 localStorage.setItem('treasurerSidebarCollapsed','false');
});
let apiCalls=0;
await context.route('**/api/**', async route=>{
 apiCalls++;
 const path=new URL(route.request().url()).pathname;
 let data={success:true,data:{}};
 if(path.endsWith('/dashboard'))data={success:true,data:stats};
 else if(path.endsWith('/contributions'))data={success:true,data:contributions,pagination:{totalPages:1}};
 else if(path.endsWith('/balances/all'))data={success:true,data:{members:[],pagination:{totalPages:1,total:0}}};
 else if(path.endsWith('/claims/pending-deduction'))data={success:true,data:[],pagination:{total:4,totalPages:1}};
 await route.fulfill({json:data,headers:{'Access-Control-Allow-Origin':'*'}});
});
async function open(){await page.goto('http://localhost:5173/mortuary/finance_officer');await page.getByRole('heading',{name:'Mortuary dashboard',exact:true}).waitFor();await page.locator('.recharts-bar-rectangle').first().waitFor();}
async function capture(name){await page.screenshot({path:`design-previews/treasurer-dashboard/${name}.png`,fullPage:true,animations:'disabled'});}
await open();await capture('desktop');
for(const [label,tab] of [['Open member ledger','ledger'],['Review claims','claims'],['View balances','members']]){
 await page.getByRole('button',{name:label,exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('tab')===tab);
 await open();
}
const before=apiCalls;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.treasurer-dashboard').getAttribute('aria-busy')||document.querySelector('.treasurer-dashboard').getAttribute('aria-busy')==='false');assert.ok(apiCalls>before);
await page.getByText('More fund insights',{exact:true}).click();await page.getByRole('heading',{name:'Fund activity',exact:true}).waitFor();
await page.getByText('View monthly contribution data',{exact:true}).click();assert.equal(await page.locator('.td-chart-data tbody tr').count(),6);
await capture('insights');
await page.getByText('More fund insights',{exact:true}).click();
await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.getByRole('button',{name:'Expand sidebar',exact:true}).waitFor();await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
const sizes=[[834,1194],[390,844],[320,740],[1366,700]];
const dimensions=[];
for(const [width,height] of sizes){
 await page.setViewportSize({width,height});await open();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow ${width}`);
 assert.ok(await page.locator('.mt-main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`main overflow ${width}`);
 await capture(`viewport-${width}`);
 await page.locator('.mt-main').evaluate(el => { el.scrollTop = el.scrollHeight; });
 await capture(`scrolled-${width}`);
 await page.locator('.mt-main').evaluate(el => { el.scrollTop = 0; });
 if(width<1024){
 await page.getByRole('button',{name:'Open menu',exact:true}).click();
 await page.getByRole('button',{name:'Close menu',exact:true}).waitFor();
 await page.waitForFunction(() => Math.abs(document.querySelector('.mt-sidebar').getBoundingClientRect().width - 296) < 1);
 await capture(`menu-${width}`);
 await page.getByRole('button',{name:'Close menu',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).getAttribute('aria-expanded'),'false');
 }
 dimensions.push({width,height,main:await page.locator('.mt-main').boundingBox()});
}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'passed',api:'intercepted fixtures only',errors,dimensions}));
await browser.close();
