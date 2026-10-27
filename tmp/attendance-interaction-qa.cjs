const { chromium } = require('../client/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const out = path.resolve('design-previews/attendance'); fs.mkdirSync(out, {recursive:true});
const now=new Date(); const day=now.toISOString().slice(0,10);
const members=Array.from({length:8},(_,i)=>({_id:`member-${i}`,memberId:`M-${i+1}`,memberName:`Sample Member ${i+1}`,firstName:'Sample',lastName:`Member ${i+1}`,status:'active',barangay:'San Vicente',passbookNumber:`PB-00${i+1}`,createdAt:now.toISOString()}));
const events=['active','upcoming','pending_approval','draft','completed','rejected'].map((status,i)=>({_id:`event-${i}`,eventId:`E-${i}`,eventName:['General Assembly','Member Orientation','Community Meeting','Planning Session','Quarterly Assembly','Committee Meeting'][i],name:['General Assembly','Member Orientation','Community Meeting','Planning Session','Quarterly Assembly','Committee Meeting'][i],status,eventDate:day,date:day,startTime:'00:00',endTime:'23:59',location:'Cooperative Hall',createdAt:now.toISOString()}));
const attendance=members.slice(0,5).map((m,i)=>({_id:`scan-${i}`,memberId:m.memberId,memberName:m.memberName,eventId:'E-0',eventName:'General Assembly',barangay:m.barangay,scanTime:now.toISOString(),status:'present',scannedByName:'Preview Staff'}));
const checks=[],errors=[],mutations=[]; let previewMode='normal';
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const role of ['admin','secretary','scanner_operator']) {
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.addInitScript(({role})=>{sessionStorage.setItem('token','isolated-visual-preview');sessionStorage.setItem('user',JSON.stringify({_id:'preview-staff',id:'preview-staff',role,modules:['attendance'],name:'Preview Staff'}));sessionStorage.setItem('selectedModule',JSON.stringify({module:'attendance',role}));}, {role});
  await context.route('**/api/**',async route=>{
   const req=route.request(); if(req.method()==='OPTIONS')return route.fulfill({status:204});
   if(req.method()!=='GET'){mutations.push(req.method()+' '+req.url());return route.fulfill({status:403,json:{success:false,message:'Preview does not permit mutations'}});}
   if(previewMode==='error')return route.fulfill({status:500,json:{success:false,message:'Isolated preview error'}}); const url=new URL(req.url());
   let data={success:true,members,events,attendance,attendanceLogs:attendance,scans:attendance,logs:[],reports:[],stats:{},count:members.length,total:members.length,pagination:{page:1,totalPages:1,total:members.length,hasNextPage:false}};
   if(url.pathname.includes('/members')) data={...data,data:members};
   else if(url.pathname.includes('/events')) data={...data,data:events};
   else if(url.pathname.includes('/audit')) data={...data,data:{logs:[],pagination:{page:1,totalPages:1,total:0}}};
   else data={...data,data:attendance};
   if(previewMode==='empty')data={...data,members:[],events:[],attendance:[],attendanceLogs:[],scans:[],data:[],count:0,total:0}; await route.fulfill({json:data});
  });
  const page=await context.newPage(); page.on('pageerror',e=>errors.push({role,error:e.message}));
  const tabs=role==='admin'?['dashboard']:['home'];
  for(const [width,height] of [[390,844]]) {
   await page.setViewportSize({width,height});
   for(const tab of tabs){
    await page.goto(`http://127.0.0.1:5173/attendance/${role}?tab=${tab}`);
    await page.locator('.attendance-workspace').waitFor();
    await page.waitForTimeout(250);
    const check=await page.evaluate(()=>{
     const main=document.querySelector('main'); const r=main?.getBoundingClientRect();
     const overflow=[...document.querySelectorAll('main *')].filter(el=>{const b=el.getBoundingClientRect();if(!b.width)return false;let a=el.parentElement;while(a&&a!==main){if(['auto','scroll'].includes(getComputedStyle(a).overflowX))return false;a=a.parentElement;}return b.right>innerWidth+2||b.left< -2;}).slice(0,5).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70)}));
     return {pageOverflow:document.documentElement.scrollWidth>innerWidth,mainOverflow:main?.scrollWidth>main?.clientWidth+1,overflow,heading:document.querySelector('main h1')?.textContent,mainBottom:r?.bottom,scrollable:main?.scrollHeight>main?.clientHeight};
    });
    checks.push({role,tab,width,height,...check}); fs.writeFileSync(path.join(out,'interaction-checks.json'),JSON.stringify({fixtureData:true,checks,errors,mutations},null,2));
    if((width===1440&&height===1000)||(width===390&&['home','dashboard','scanner','events','reports'].includes(tab)))await page.screenshot({path:path.join(out,`${role}-${tab}-${width}.png`)});
   }
  }
  // Exercise real navigation handlers in the preview without touching the API server.
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.locator('.attendance-sidebar nav button').first().click();
  await page.waitForTimeout(250);
  checks.push({role,interaction:'mobile navigation',passed:await page.locator('.attendance-sidebar').evaluate(el=>el.getBoundingClientRect().width===0)});
  await page.getByRole('button',{name:'Open menu',exact:true}).click(); await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  checks.push({role,interaction:'Escape closes menu',passed:await page.locator('.attendance-sidebar').evaluate(el=>el.getBoundingClientRect().width===0)});

  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('button',{name:'Close menu',exact:true}).click();
  await page.waitForTimeout(400);
  checks.push({role,interaction:'Close menu button',passed:await page.locator('.attendance-sidebar').evaluate(el=>el.getBoundingClientRect().width===0)});
  await page.setViewportSize({width:1440,height:600});
  await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.waitForTimeout(400);
  checks.push({role,interaction:'phone menu retains labels after desktop collapse',passed:(await page.locator('.attendance-sidebar nav').textContent()).includes('Dashboard')});
  await page.screenshot({path:path.join(out,role+'-mobile-menu.png')});
  await page.keyboard.press('Escape');
  if(role==='secretary') {
    await page.goto('http://127.0.0.1:5173/attendance/secretary?tab=events');
    await page.getByRole('button',{name:'Create event',exact:true}).first().click();
    await page.getByRole('dialog').waitFor();
    for(const width of [320,390,834,1440]) {
      await page.setViewportSize({width,height:600});
      checks.push({role,width,interaction:'event dialog fits viewport',passed:await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})});
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,'secretary-create-event-390.png')});
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'detached'});
    checks.push({role,interaction:'event dialog Escape closes without submission',passed:true});
    await page.goto('http://127.0.0.1:5173/attendance/secretary?tab=reports');
    await page.getByRole('button',{name:/View attendees for/}).first().click();
    await page.getByRole('button',{name:/Back to Reports/}).waitFor();
    await page.screenshot({path:path.join(out,'secretary-attendees-390.png')});
    await page.getByRole('button',{name:/Back to Reports/}).click();
    checks.push({role,interaction:'report attendees and back',passed:await page.getByRole('heading',{name:'Attendance Reports',exact:true}).isVisible()});
  }
  for(const mode of ['empty','error']) {
    previewMode=mode;
    await page.goto('http://127.0.0.1:5173/attendance/'+role);
    await page.waitForTimeout(500);
    checks.push({role,interaction:mode+' state',passed:await page.locator('main').isVisible(),text:(await page.locator('main').innerText()).slice(0,150)});
    await page.screenshot({path:path.join(out,role+'-'+mode+'-390.png')});
  }
  previewMode='normal';
  await context.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'interaction-checks.json'),JSON.stringify({fixtureData:true,checks,errors,mutations},null,2));
 console.log(JSON.stringify({checks:checks.length,failures:checks.filter(x=>x.pageOverflow||x.mainOverflow||x.passed===false),errors,mutations},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
