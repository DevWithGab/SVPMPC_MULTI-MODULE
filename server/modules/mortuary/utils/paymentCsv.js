const MAX_ROWS = 500;
const MAX_BYTES = 1024 * 1024;
const HEADERS = ['member_id', 'amount', 'payment_date', 'reference_number'];
const OPTIONAL = ['payment_method', 'notes'];
const aliases = {
  memberid: 'member_id', paymentdate: 'payment_date',
  referencenumber: 'reference_number', paymentmethod: 'payment_method',
};

// Strict CSV reader: quoted commas, escaped quotes, CRLF, BOM and multiline notes.
function readCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  let line = 1, rowLine = 1;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const pushRow = () => {
    pushCell();
    if (row.some(Boolean)) { row.line = rowLine; rows.push(row); }
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error(`Maximum ${MAX_ROWS} payments per upload.`);
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

function parsePaymentCsv(csv) {
  if (typeof csv !== 'string' || !csv.trim()) throw new Error('Choose a CSV file containing payments.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new Error('CSV file must be 1 MB or smaller.');
  const [rawHeaders, ...rows] = readCsv(csv);
  if (!rawHeaders || !rows.length) throw new Error('CSV must contain a header and at least one payment.');
  const headers = rawHeaders.map(header => {
    const key = header.toLowerCase().replace(/\s+/g, '_');
    return aliases[key] || key;
  });
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');
  const missing = HEADERS.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}.`);
  const unknown = headers.filter(header => ![...HEADERS, ...OPTIONAL].includes(header));
  if (unknown.length) throw new Error(`Unknown columns: ${unknown.join(', ')}. Use the downloadable template.`);
  const seen = new Set();
  return rows.map(cells => {
    const source = Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']));
    const errors = [];
    const entry = {
      memberId: source.member_id,
      amount: Number(source.amount),
      paymentDate: source.payment_date,
      referenceNumber: source.reference_number,
      paymentMethod: (source.payment_method || 'cash').toLowerCase(),
      notes: source.notes || '',
    };
    if (cells.length !== headers.length) errors.push('Column count does not match the header');
    if (!entry.memberId || entry.memberId.length > 100) errors.push('Member ID is required (maximum 100 characters)');
    if (!/^\d+(\.\d{1,2})?$/.test(source.amount) || entry.amount <= 0 || !Number.isSafeInteger(Math.round(entry.amount * 100))) errors.push('Amount must be positive with at most 2 decimal places');
    const date = new Date(`${entry.paymentDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.paymentDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.paymentDate) errors.push('Payment date must be a valid YYYY-MM-DD date');
    if (!entry.referenceNumber || entry.referenceNumber.length > 100) errors.push('Receipt / transaction reference is required (maximum 100 characters)');
    if (entry.paymentMethod !== 'cash') errors.push('Only cash payments are supported');
    if (entry.notes.length > 1000) errors.push('Notes must be 1,000 characters or fewer');
    const key = JSON.stringify([entry.memberId, entry.referenceNumber]);
    if (seen.has(key)) errors.push('Repeated member ID and reference in this CSV; use a unique reference for each payment');
    seen.add(key);
    return { row: cells.line, entry, errors };
  });
}

module.exports = { parsePaymentCsv, MAX_ROWS, MAX_BYTES };
