const fs = require('fs');
let source = fs.readFileSync('tmp/attendance-visual-qa.cjs', 'utf8');
source = source.replace("['admin','secretary','scanner_operator']", "['admin']")
  .replace("['dashboard','live','events','members','auditlogs','backup']", "['dashboard']")
  .replace('[[1440,1000],[390,844],[320,740],[834,1112],[1440,600]]', '[[1440,1000],[390,844]]')
  .replaceAll("'checks.json'", "'final-dashboard-checks.json'");
eval(source);
