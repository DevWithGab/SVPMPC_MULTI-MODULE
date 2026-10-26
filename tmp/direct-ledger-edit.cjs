const fs = require('fs');
const file = 'server/modules/mortuary/utils/ledgerCorrections.js';
fs.writeFileSync(file, `const { isCorrectable } = require('../services/ledgerCorrectionService');
const money = value => Math.round(value * 100) / 100;

// Immutable audit postings are folded into one current transaction per statement.
function decorateLedgerEntries(formatted, documents, allEntries) {
  const ordered = [...allEntries].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a._id).localeCompare(String(b._id)));
  const latest = new Map();
  for (const row of ordered) if (row.correction) latest.set(row.correction.rootLedgerId, row);
  const firstByMember = new Map(), balances = new Map(), projected = new Map();
  for (const row of ordered) {
    if (row.correction) continue;
    if (!firstByMember.has(row.memberId)) firstByMember.set(row.memberId, row.ledgerId);
    const edit = latest.get(row.ledgerId);
    const credit = edit ? edit.correction.afterAmount : row.credit || 0;
    const balance = money((balances.get(row.memberId) || 0) + credit - (row.debit || 0));
    balances.set(row.memberId, balance);
    projected.set(row.ledgerId, { edit, credit, balance });
  }
  return formatted.flatMap((entry, index) => {
    const doc = documents[index];
    if (doc.correction) return [];
    const { edit, credit, balance } = projected.get(doc.ledgerId);
    const source = edit || doc;
    const pending = edit && !edit.correction.completed;
    return [{ ...entry, received: credit, balance, sourceLedgerId: source.ledgerId,
      canCorrect: Boolean(isCorrectable(source, firstByMember.get(doc.memberId))),
      correctionPending: Boolean(pending),
      pendingCorrection: pending ? { sourceLedgerId: edit.correctionOf, amount: edit.correction.afterAmount,
        expectedAmount: edit.correction.beforeAmount, reason: edit.correction.reason || '' } : null }];
  });
}
module.exports = { decorateLedgerEntries };
`);
function edit(path, fn) { let s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n'); const next=fn(s); if(next===s) throw Error(path); fs.writeFileSync(path,next); }
edit('server/modules/mortuary/models/Ledger.js', s=>s.replace("reason: { type: String, required: true }", "reason: { type: String, default: '' }"));
edit('server/modules/mortuary/services/ledgerCorrectionService.js', s=>s.replace(/  if \(typeof reason[^\n]+\n  return \{ amount: Number\(amount\), reason: reason.trim\(\) \};/, "  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) throw fail(400, 'An optional note must be at most 500 characters.');\n  return { amount: Number(amount), reason: reason?.trim() || '' };")
.replace('description: `Ledger amount corrected: ${correction.reason}`', "description: correction.reason ? `Ledger amount edited: ${correction.reason}` : 'Ledger amount edited'")
.replace('posting.correction.reason !== values.reason', "(posting.correction.reason || '') !== values.reason")
.replace('select the latest replacement entry', 'edit the current amount again')
.replace('description: `Correction: ${values.reason}`', "description: values.reason ? `Amount edit: ${values.reason}` : 'Ledger amount edit'"));
edit('server/modules/mortuary/controllers/ledgerController.js', s=>s
.replace('const total = await Ledger.countDocuments({ memberId });', "const total = await Ledger.countDocuments({ memberId, correction: { $exists: false } });")
.replace('const ledgerEntries = await Ledger.find({ memberId })', "const ledgerEntries = await Ledger.find({ memberId, correction: { $exists: false } })")
.replace('const totalCredits = allEntries.reduce((sum, entry) => sum + entry.credit, 0);\n    const totalDebits = allEntries.reduce((sum, entry) => sum + entry.debit, 0);', "const totals = decorateLedgerEntries(allEntries.map(entry => ({ received: entry.credit, withdrawn: entry.debit })), allEntries, allEntries);\n    const totalCredits = Math.round(totals.reduce((sum, entry) => sum + entry.received, 0) * 100) / 100;\n    const totalDebits = Math.round(totals.reduce((sum, entry) => sum + (entry.withdrawn || 0), 0) * 100) / 100;")
.replace('let query = {};', "let query = { correction: { $exists: false } };")
.replace('res.status(200).json(buildPaginatedResponse(formattedEntries, total, page, limit));', "const allEntries = await Ledger.find({ memberId: { $in: [...new Set(ledgerEntries.map(entry => entry.memberId))] } });\n    res.status(200).json(buildPaginatedResponse(decorateLedgerEntries(formattedEntries, ledgerEntries, allEntries), total, page, limit));")
.replace('Correction recorded. The original entry is preserved.', 'Amount updated. The change is recorded in the audit log.'));
