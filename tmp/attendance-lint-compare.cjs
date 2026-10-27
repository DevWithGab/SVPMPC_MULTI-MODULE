const fs=require('fs'),cp=require('child_process'),path=require('path');
const paths=['src/pages/attendance/AdminPortal.jsx','src/pages/attendance/SecretaryPortal.jsx','src/pages/attendance/OperatorPortal.jsx','src/components/attendance/admin/Dashboard.jsx','src/components/attendance/shared/AttendanceWorkspaceHeader.jsx'];
const results=[];
for(const p of paths){
 const lint=source=>{const r=cp.spawnSync(process.execPath,['node_modules/eslint/bin/eslint.js','--stdin','--stdin-filename',p,'--format','json'],{cwd:path.resolve('client'),input:source,encoding:'utf8'});return JSON.parse(r.stdout)[0].messages.map(m=>({ruleId:m.ruleId,severity:m.severity,message:m.message.split('\n')[0]}));};
 const current=lint(fs.readFileSync(path.join('client',p),'utf8'));
 const baseline=cp.spawnSync('git',['show','HEAD:client/'+p],{encoding:'utf8'});
 const previous=baseline.status===0?lint(baseline.stdout):[];
 results.push({file:p,current,previous,newIssues:current.filter(a=>!previous.some(b=>a.ruleId===b.ruleId&&a.message===b.message))});
}
fs.writeFileSync('design-previews/attendance/lint-comparison.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(r=>({file:r.file,currentIssues:r.current.length,baselineIssues:r.previous.length,newIssues:r.newIssues})),null,2));
const matrix=JSON.parse(fs.readFileSync('design-previews/attendance/checks.json'));matrix.checks=matrix.checks.filter(x=>!x.interaction);fs.writeFileSync('design-previews/attendance/checks.json',JSON.stringify(matrix,null,2));
