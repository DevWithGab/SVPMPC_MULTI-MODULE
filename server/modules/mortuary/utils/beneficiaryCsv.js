const MAX_ROWS = 500;
const MAX_BYTES = 1024 * 1024;
const HEADERS = ['member_id', 'beneficiary_name', 'relationship', 'contact_number'];
const OPTIONAL = ['address', 'notes'];
const aliases = {
  passbookno: 'member_id', passbooknumber: 'member_id', memberid: 'member_id',
  beneficiaryname: 'beneficiary_name', contactnumber: 'contact_number', mobilenumber: 'contact_number',
};

// PH mobile numbers: 11 digits, starting with 09 — mirrors
// beneficiaryController.js's PH_PHONE_REGEX, the single-register backstop.
const PH_PHONE_REGEX = /^09\d{9}$/;

// Strict CSV reader: quoted commas, escaped quotes, CRLF, BOM and multiline
// notes. Copied from paymentCsv.js's reader — same format family, kept as
// its own copy rather than a shared extraction so each importer's row cap
// and column set stay independently editable.
function readCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  let line = 1, rowLine = 1;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const pushRow = () => {
    pushCell();
    if (row.some(Boolean)) { row.line = rowLine; rows.push(row); }
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error(`Maximum ${MAX_ROWS} beneficiaries per upload.`);
  };
  text = text.replace(/^﻿/, '');
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

function parseBeneficiaryCsv(csv) {
  if (typeof csv !== 'string' || !csv.trim()) throw new Error('Choose a CSV file containing beneficiaries.');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new Error('CSV file must be 1 MB or smaller.');
  const [rawHeaders, ...rows] = readCsv(csv);
  if (!rawHeaders || !rows.length) throw new Error('CSV must contain a header and at least one beneficiary.');
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
    const entry = {
      memberId: source.member_id,
      beneficiaryName: source.beneficiary_name,
      relationship: source.relationship,
      contactNumber: source.contact_number,
      address: source.address || '',
      notes: source.notes || '',
    };
    if (cells.length !== headers.length) errors.push('Column count does not match the header');
    if (!entry.memberId || entry.memberId.length > 100) errors.push('Passbook No. is required (maximum 100 characters)');
    if (!entry.beneficiaryName || entry.beneficiaryName.length > 200) errors.push('Beneficiary name is required (maximum 200 characters)');
    if (!entry.relationship || entry.relationship.length > 100) errors.push('Relationship is required (maximum 100 characters)');
    if (!PH_PHONE_REGEX.test(entry.contactNumber)) errors.push('Contact number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567)');
    if (entry.address.length > 300) errors.push('Address must be 300 characters or fewer');
    if (entry.notes.length > 1000) errors.push('Notes must be 1,000 characters or fewer');
    if (seen.has(entry.memberId)) errors.push('This Passbook No. appears more than once in this CSV; keep one row per member per upload');
    seen.add(entry.memberId);
    return { row: cells.line, entry, errors };
  });
}

module.exports = { parseBeneficiaryCsv, MAX_ROWS, MAX_BYTES };
