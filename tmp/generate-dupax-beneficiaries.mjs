import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseMemberUpload } from '../client/src/utils/memberBulkUpload.js';

const require = createRequire(import.meta.url);
const { parseBeneficiaryCsv } = require('../server/modules/mortuary/utils/beneficiaryCsv.js');
const directory = path.resolve('sample-data/testing-20261031-dupax-del-sur');
const members = parseMemberUpload(fs.readFileSync(path.join(directory, '01-members-200.csv'), 'utf8')).members;
const names = ['Juana', 'Pedro', 'Josefina', 'Manuel', 'Carmelita', 'Roberto', 'Leonora', 'Antonio', 'Remedios', 'Ricardo', 'Gloria', 'Alfredo', 'Leticia', 'Fernando', 'Imelda', 'Gregorio', 'Nerissa', 'Vicente', 'Dolores', 'Benjamin'];
const rows = members.slice(0, 50).map((member, index) => [
  member.passbookNo,
  `${names[index % names.length]} ${member.memberName.split(' ').slice(1).join(' ')}`,
  'Spouse',
  `0999${String(index + 1).padStart(7, '0')}`,
  member.address,
  'Fictional beneficiary and contact number for testing',
]);
const headers = ['Passbook No.', 'beneficiary_name', 'relationship', 'contact_number', 'address', 'notes'];
const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(value => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(',')).join('\r\n') + '\r\n';
const parsed = parseBeneficiaryCsv(csv);
assert.equal(parsed.length, 50);
assert.equal(new Set(parsed.map(row => row.entry.beneficiaryName)).size, 50);
parsed.forEach((row, index) => {
  assert.deepEqual(row.errors, []);
  assert.equal(row.entry.memberId, String(index + 1).padStart(4, '0'));
  assert.equal(row.entry.address, members[index].address);
});
const filename = '04-beneficiaries-members-0001-0050.csv';
fs.writeFileSync(path.join(directory, filename), csv);
const guidePath = path.join(directory, 'README.md');
const guide = fs.readFileSync(guidePath, 'utf8');
if (!guide.includes(filename)) fs.appendFileSync(guidePath, `
## Beneficiaries for members 0001 through 0050

Upload ${filename} through Mortuary > Claims > Beneficiaries > Bulk Upload after importing the members. The file contains 50 fictional Filipino beneficiaries, one spouse per member, with addresses matching each member's barangay in Dupax del Sur, Nueva Vizcaya. Contact numbers are synthetic test values in the required 11-digit format; they are not verified real contacts.

Columns: Passbook No., beneficiary_name, relationship, contact_number (required); address, notes (optional). Passbooks preserve their leading zeros. Validated all 50 rows with the application's beneficiary CSV parser, with no errors. An import for a member with an existing beneficiary supersedes the active beneficiary and keeps the previous record in History.
`);
console.log(`Created and validated ${filename}: 50 beneficiaries for passbooks 0001-0050, no validation errors.`);
