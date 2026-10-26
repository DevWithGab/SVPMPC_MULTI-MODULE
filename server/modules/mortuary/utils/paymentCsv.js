const MAX_ROWS = 1000;
const MAX_BYTES = 1024 * 1024;
const HEADERS = ['member_id', 'amount', 'payment_date', 'reference_number'];
const OPTIONAL = ['payment_method', 'notes'];
const { parseCsvDate } = require('../../../shared/utils/csvDate');
const aliases = {
  passbookno: 'member_id', passbooknumber: 'member_id',
  memberid: 'member_id', paymentdate: 'payment_date',
  referencenumber: 'reference_number', paymentmethod: 'payment_method',
};

// Strict CSV reader: quoted commas, escaped quotes, CRLF, BOM and multiline notes.
function readCsv(text, maxRows = MAX_ROWS, rowLabel = 'payments') {
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  let line = 1, rowLine = 1;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const pushRow = () => {
    pushCell();
    if (row.some(Boolean)) { row.line = rowLine; rows.push(row); }
    row = [];
    if (rows.length > maxRows + 1) throw new Error(`Maximum ${maxRows} ${rowLabel} per upload.`);
  };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line++;
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') pushCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRow();
      rowLine = ++line;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === '"' || closed) throw new Error('Malformed CSV quoting. Use the downloadable template.');
    else cell += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell || row.length || closed) pushRow();
  return rows;
}

function parsePaymentCsv(csv, dateOrder = 'auto') {
  if (typeof csv !== 'string' || !csv.trim()) throw new Error('Choose a CSV file containing payments.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new Error('CSV file must be 1 MB or smaller.');
  const [rawHeaders, ...rows] = readCsv(csv);
  if (!rawHeaders || !rows.length) throw new Error('CSV must contain a header and at least one payment.');
  const headers = rawHeaders.map(header => {
    const key = header.toLowerCase().replace(/\s+/g, '_');
    return aliases[key.replace(/[^a-z0-9]/g, '')] || key;
  });
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');
  const missing = HEADERS.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing columns: ${missing.map(header => header === 'member_id' ? 'Passbook No.' : header).join(', ')}.`);
  const unknown = headers.filter(header => ![...HEADERS, ...OPTIONAL].includes(header));
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(', ')}. Use the downloadable template.`);
  const seen = new Set();
  return rows.map(cells => {
    const source = Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']));
    const errors = [];
    const parsedDate = parseCsvDate(source.payment_date, dateOrder);
    const normalizedDate = parsedDate.value;
    const entry = {
      memberId: source.member_id,
      amount: Number(source.amount),
      paymentDate: normalizedDate || source.payment_date,
      referenceNumber: source.reference_number,
      paymentMethod: (source.payment_method || 'cash').toLowerCase(),
      notes: source.notes || '',
    };
    if (cells.length !== headers.length) errors.push('Column count does not match the header');
    if (!entry.memberId || entry.memberId.length > 100) errors.push('Passbook No. is required (maximum 100 characters)');
    if (!/^\d+(\.\d{1,2})?$/.test(source.amount) || entry.amount <= 0 || !Number.isSafeInteger(Math.round(entry.amount * 100))) errors.push('Amount must be positive with at most 2 decimal places');
    if (!normalizedDate) errors.push('Payment date: ' + parsedDate.error);
    if (!entry.referenceNumber || entry.referenceNumber.length > 100) errors.push('Receipt / transaction reference is required (maximum 100 characters)');
    if (entry.paymentMethod !== 'cash') errors.push('Only cash payments are supported');
    if (entry.notes.length > 1000) errors.push('Notes must be 1,000 characters or fewer');
    const key = JSON.stringify([entry.memberId, entry.referenceNumber]);
    if (seen.has(key)) errors.push('Repeated passbook number and reference in this CSV; use a unique reference for each payment');
    seen.add(key);
    return { row: cells.line, entry, errors };
  });
}

module.exports = { parsePaymentCsv, readCsv, MAX_ROWS, MAX_BYTES };
