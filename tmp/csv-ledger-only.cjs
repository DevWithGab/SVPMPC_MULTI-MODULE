const fs=require('fs');
function edit(path, fn) { const s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n'); const n=fn(s); if(n===s) throw Error(path); fs.writeFileSync(path,n); }
edit('server/modules/mortuary/services/ledgerCorrectionService.js', s=>s.replace("entry.transactionType === 'adjustment' && entry.ledgerId === firstId", "entry.transactionType === 'adjustment' && (entry.ledgerId === firstId || Boolean(entry.importKey))").replace('Only payments and the opening credit balance can be corrected here.', 'Only payments, opening credit balances, and CSV-uploaded credit adjustments can be edited here.'));
edit('client/src/components/mortuary/treasurer/MemberLedger.jsx', s=>s.replace('  onAddDeposit,\n','').replace(/          <ActionButton variant="default"\n            onClick=\{\(\) => onAddDeposit\(currentMember\)\}[\s\S]*?<\/ActionButton>\n/,'').replace('Find a member to review their contributions, deductions, and running balance.', 'Upload daily transactions by CSV, then select a member to review or edit recorded amounts.'));
edit('client/src/pages/mortuary/TreasurerPortal.jsx', s=>s
.replace("import Swal from 'sweetalert2';\n",'')
.replace("import RecordContributionModal from '../../components/mortuary/treasurer/RecordContributionModal';\n",'')
.replace(/const contributionAlert = Swal.mixin\([\s\S]*?\n\}\);\n/,'')
.replace(/  const \[isAddContributionOpen[^\n]*\n/,'').replace(/  const \[isSubmittingContribution[^\n]*\n/,'').replace(/  const contributionInFlight[^\n]*\n/,'')
.replace(/  \/\/ Form data states\n[\s\S]*?  const \[selectedMemberId/, '  const [selectedMemberId')
.replace(/  \/\* "Add Deposit"[\s\S]*?  \/\/ Refresh all data/, '  // Refresh all data')
.replace(/  \/\/ Event handlers\n  const handleAddContribution[\s\S]*?  \/\/ Effects/, '  // Effects')
.replace(/  \/\* Minsan lang kukunin[\s\S]*?\}, \[isAddContributionOpen, fetchMembers\]\);\n/, '')
.replace('            onAddDeposit={openAddDepositForMember}\n','')
.replace(/      <RecordContributionModal[\s\S]*?      \/>\n/,''));
