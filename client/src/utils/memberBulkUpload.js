import { isPassbookHeader } from './importHeaders.js';

export function parseMemberUpload(text) {
  const records = [];
  const rowNumbers = [];
  let line = 1, recordLine = 1;
  let fields = [], value = '', quoted = false;
  const finishRow = () => {
    fields.push(value.trim());
    if (fields.some(Boolean)) { records.push(fields); rowNumbers.push(recordLine); }
    fields = []; value = '';
  };
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { fields.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      finishRow();
      if (char === '\r' && source[i + 1] === '\n') i++;
      line++; recordLine = line;
    } else {
      value += char;
      if (char === '\n' || (char === '\r' && source[i + 1] !== '\n')) line++;
    }
  }
  if (quoted) throw new Error('A quoted field is not closed. Check quotation marks in the CSV and choose the corrected file.');
  finishRow();
  if (records.length < 2) throw new Error('The CSV has no member rows. Add members below the column headers.');
  const [headers, ...rows] = records;
  const required = ['memberName', 'barangay', 'address'];
  const missing = required.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}. Keep the template headers unchanged.`);
  if (new Set(headers.map(header => isPassbookHeader(header) ? 'passbookNo' : header)).size !== headers.length) {
    throw new Error('The CSV has duplicate column headers. Keep only one column for each field.');
  }
  const members = rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${rowNumbers[index + 1]} has ${values.length} values; expected ${headers.length}. Put addresses containing commas inside double quotes.`);
    const entry = Object.fromEntries(headers.map((header, i) => [isPassbookHeader(header) ? 'passbookNo' : header, values[i]]));
    return { ...entry, gender: entry.gender || 'male', modules: ['attendance', 'mortuary'] };
  });
  return { members, rowNumbers: rowNumbers.slice(1), preview: rows.slice(0, 5).map(values => Object.fromEntries(headers.map((header, i) => [header, values[i]]))) };
}

export function memberUploadError(error) {
  if (!error.response) return 'The upload could not be confirmed. Check your connection, then refresh the member list before retrying to avoid uploading members twice.';
  return error.response.data?.message || 'The server could not process this upload. Please try again later.';
}
