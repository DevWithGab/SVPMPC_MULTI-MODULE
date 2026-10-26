const fs=require('fs');
function edit(path, fn) { const s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n'); const n=fn(s); if(n===s) throw Error(path); fs.writeFileSync(path,n); }
edit('client/src/components/mortuary/treasurer/LedgerCorrectionDialog.jsx', s=>s
.replace('historyOnly = false, ', '')
.replace("  const [reason, setReason] = useState(pending?.reason || '');\n", '')
.replace(" && reason.trim().length >= 10 && reason.trim().length <= 500", '')
.replace('reason: reason.trim()', "reason: pending?.reason || ''")
.replace("{historyOnly ? 'Correction history' : pending ? 'Finish saved correction' : 'Correct entry'}", "{pending ? 'Finish saved edit' : 'Edit amount'}")
.replace(/    \{historyOnly \? <ol[\s\S]*?<\/ol> : <>/, '    <>')
.replace('The original entry stays in the ledger. A linked reversal and replacement record the correction.', 'The ledger and printed statement will show the updated amount. Your name, the time, and the old and new amounts are saved in the audit log.')
.replace(/        <label className="block text-sm font-medium">Reason for correction[\s\S]*?<\/label>\n/, '')
.replace(/        <p className="text-xs text-slate-500">Required:[^\n]+\n/, '')
.replace('    </>}', '    </>')
.replace(/        <p className="whitespace-pre-wrap break-words text-sm"><strong>Reason:<\/strong>[^\n]+\n/, '')
.replaceAll('!historyOnly && ', '')
.replaceAll('Review correction', 'Review change').replaceAll('Retry correction', 'Retry save').replaceAll('Confirm correction', 'Save amount')
.replaceAll('Corrected amount', 'New amount').replaceAll('Balance after correction', 'Balance after edit'));
edit('client/src/components/mortuary/treasurer/MemberLedger.jsx', s=>s
.replace(' historyOnly={correctionDialog.historyOnly}', '')
.replace('Correction recorded. The original entry has been preserved.', 'Amount updated. The change is saved in the audit log.')
.replace(/        \{memberLedgerEntries.some\(entry => entry.correctionKind\)[^\n]+\n/, '')
.replace(/                        \{\(entry.corrected \|\| entry.correctionKind\)[^\n]+\n/, '')
.replace(/                          \{entry.correctionHistory\?\.length[^\n]+\n/, '')
.replace('Correction needs retry', 'Edit needs retry').replace("'Finish correction' : 'Correct entry'", "'Finish edit' : 'Edit amount'"));
edit('client/src/utils/memberLedgerPdf.js', s=>s.replace(/dateText\(entry.date\), `\$\{entry.ref_no[^\n]+/, "dateText(entry.date), String(entry.ref_no ?? ''),"));
edit('server/modules/mortuary/services/ledgerImportService.js', s=>s.replace('Use Correct entry in the member ledger', 'Use Edit amount in the member ledger'));
