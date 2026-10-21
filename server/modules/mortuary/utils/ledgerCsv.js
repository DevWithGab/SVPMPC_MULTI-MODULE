const { readCsv, MAX_BYTES } = require('./paymentCsv');
const TYPES = ['contribution', 'payout', 'adjustment', 'penalty', 'automatic_deduction', 'claim_payout'];
const REQUIRED = ['memberId', 'transactionDate', 'credit', 'debit'];
const OPTIONAL = ['description', 'transactionType', 'referenceId', 'paymentMethod', 'status', 'ledgerId'];
const MAX_ROWS = 1000;
const keyOf = entry => JSON.stringify([entry.memberId, entry.transactionDate, entry.credit, entry.debit, entry.referenceId || null]);

function validateLedgerEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Provide at least one ledger entry.');
  if (entries.length > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} entries per upload.`);
  const seen = new Set();
  const ledgerIds = new Set();
  return entries.map((source, index) => {
    const errors = [...(source.csvErrors || [])];
    const entry = {};
    for (const field of [...REQUIRED, ...OPTIONAL]) entry[field] = String(source[field] ?? '').trim();
    if (!entry.memberId || entry.memberId.length > 100) errors.push('Passbook No. is required (maximum 100 characters).');
    const date = new Date(`${entry.transactionDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.transactionDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.transactionDate) errors.push('Use a valid transactionDate in YYYY-MM-DD format.');
    for (const field of ['credit', 'debit']) {
      const value = entry[field] || '0';
      if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(Math.round(Number(value) * 100))) errors.push(`${field} must be a non-negative amount with up to 2 decimal places, without currency signs or commas.`);
      entry[field] = Number(value);
    }
    if (!(entry.credit > 0 && entry.debit === 0) && !(entry.debit > 0 && entry.credit === 0)) errors.push('Enter a positive credit or debit, with 0 in the other column.');
    entry.transactionType = entry.transactionType || (entry.credit > 0 ? 'contribution' : 'payout');
    if (!TYPES.includes(entry.transactionType)) errors.push(`transactionType must be one of: ${TYPES.join(', ')}.`);
    entry.paymentMethod = (entry.paymentMethod || 'cash').toLowerCase();
    if (entry.paymentMethod !== 'cash') errors.push('Only cash paymentMethod is supported.');
    entry.description = entry.description || 'Bulk upload';
    entry.referenceId = entry.referenceId || null;
    if (!entry.ledgerId) delete entry.ledgerId;
    if (entry.ledgerId && ledgerIds.has(entry.ledgerId)) errors.push('Repeated ledgerId in this CSV.');
    if (entry.ledgerId) ledgerIds.add(entry.ledgerId);
    const key = keyOf(entry);
    if (seen.has(key)) errors.push('Duplicate entry in this CSV (same passbook, date, amounts, and reference).');
    seen.add(key);
    return { row: source.csvRow || index + 2, entry, errors, status: errors.length ? 'error' : 'ready' };
  });
}

function parseLedgerCsv(csv) {
  if (typeof csv !== 'string' || !csv.trim()) throw new Error('Choose a CSV file containing ledger entries.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new Error('CSV file must be 1 MB or smaller.');
  const [rawHeaders, ...rows] = readCsv(csv, MAX_ROWS, 'entries');
  if (!rawHeaders || !rows.length) throw new Error('CSV must contain a header and at least one ledger entry.');
  const headers = rawHeaders.map(header => {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['passbookno', 'passbooknumber', 'memberid'].includes(key)) return 'memberId';
    if (key === 'refno') return 'referenceId';
    return [...REQUIRED, ...OPTIONAL].find(field => field.toLowerCase() === key) || header;
  });
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');
  const missing = REQUIRED.filter(field => !headers.includes(field));
  if (missing.length) throw new Error(`Missing columns: ${missing.map(field => field === 'memberId' ? 'Passbook No.' : field).join(', ')}.`);
  const unknown = headers.filter(field => ![...REQUIRED, ...OPTIONAL].includes(field));
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(', ')}. Use the downloadable template.`);
  return validateLedgerEntries(rows.map(cells => ({
    ...Object.fromEntries(headers.map((header, i) => [header, cells[i] || ''])),
    csvRow: cells.line,
    csvErrors: cells.length === headers.length ? [] : ['Column count does not match the header.'],
  })));
}

module.exports = { parseLedgerCsv, validateLedgerEntries, keyOf, MAX_ROWS };
