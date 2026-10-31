import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseMemberUpload } from '../client/src/utils/memberBulkUpload.js';

const require = createRequire(import.meta.url);
const { parseLedgerCsv } = require('../server/modules/mortuary/utils/ledgerCsv.js');
const barangays = ['Abaca', 'Bagumbayan', 'Balsain', 'Banila', 'Biruk', 'Canabay', 'Carolotan', 'Domang', 'Dopaj', 'Gabut', 'Ganao', 'Kimbutan', 'Kinabuan', 'Lukidnon', 'Mangayang', 'Palabotan', 'Sanguit', 'Santa Maria', 'Talbek'];
const firstNames = ['Juan', 'Maria', 'Jose', 'Ana', 'Andres', 'Luzviminda', 'Emilio', 'Rosalinda', 'Francisco', 'Maricel', 'Rogelio', 'Flordeliza', 'Danilo', 'Corazon', 'Ernesto', 'Lourdes', 'Renato', 'Teresita', 'Eduardo', 'Lualhati'];
const surnames = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Bautista', 'Ramos', 'Aquino', 'Villanueva', 'De Leon'];
const headers = ['memberName', 'email', 'phoneNumber', 'barangay', 'address', 'beneficiaries', 'beneficiaryRelationship', 'beneficiaryContactNumber', 'dateOfBirth', 'gender', 'Passbook No.'];
const members = Array.from({ length: 200 }, (_, index) => {
  const number = index + 1;
  const barangay = barangays[index % barangays.length];
  return [
    `${firstNames[index % firstNames.length]} ${surnames[Math.floor(index / firstNames.length)]}`,
    `test.20261031.member${String(number).padStart(4, '0')}@example.com`,
    '', barangay, `Purok ${index % 7 + 1}, ${barangay}, Dupax del Sur, Nueva Vizcaya`,
    '', '', '', `${1955 + index % 46}-${String(index % 12 + 1).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`,
    index % 2 === 0 ? 'male' : 'female', String(number).padStart(4, '0'),
  ];
});
const ledgerHeaders = ['Passbook No.', 'transactionDate', 'credit', 'debit', 'referenceId'];
const ledger = members.slice(0, 100).map(row => [row.at(-1), '2026-10-31', '1000.00', '0.00', `TEST-20261031-OPEN-${row.at(-1)}`]);
const csv = rows => '\uFEFF' + rows.map(row => row.map(value => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value).join(',')).join('\r\n') + '\r\n';
const memberCsv = csv([headers, ...members]);
const ledgerCsv = csv([ledgerHeaders, ...ledger]);
const parsedMembers = parseMemberUpload(memberCsv).members;
const parsedLedger = parseLedgerCsv(ledgerCsv);
assert.equal(parsedMembers.length, 200);
assert.equal(new Set(parsedMembers.map(row => row.memberName)).size, 200);
assert.equal(new Set(parsedMembers.map(row => row.passbookNo)).size, 200);
assert.deepEqual(new Set(parsedMembers.map(row => row.barangay)), new Set(barangays));
assert.equal(parsedMembers[0].passbookNo, '0001');
assert.equal(parsedMembers.at(-1).passbookNo, '0200');
assert.equal(parsedLedger.length, 100);
parsedLedger.forEach((row, index) => {
  assert.equal(row.status, 'ready');
  assert.deepEqual(row.errors, []);
  assert.equal(row.entry.memberId, parsedMembers[index].passbookNo);
  assert.equal(row.entry.credit - row.entry.debit, 1000);
});
const output = path.resolve('sample-data/testing-20261031-dupax-del-sur');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, '01-members-200.csv'), memberCsv);
fs.writeFileSync(path.join(output, '02-opening-ledger-100.csv'), ledgerCsv);
fs.writeFileSync(path.join(output, 'README.md'), `# Dupax del Sur sample import data

1. Upload 01-members-200.csv through SuperAdmin > Bulk Upload.
2. Upload 02-opening-ledger-100.csv through Mortuary > Treasurer > Member Ledger > Bulk Upload.

The member file contains 200 fictional Filipino names with passbook numbers 0001 through 0200. Addresses use all 19 barangays supplied by the user, in Dupax del Sur, Nueva Vizcaya. Each barangay has 10 or 11 members. Emails use example.com; optional phone and beneficiary fields are blank.

The ledger file has 100 opening credits dated 2026-10-31, for passbooks 0001 through 0100. Each has a PHP 1,000.00 credit and zero debit (PHP 100,000.00 total). On members with no existing transactions, this produces a PHP 1,000.00 balance each. Passbooks 0101 through 0200 have no opening ledger entries.

Ledger columns match the current template: Passbook No., transactionDate, credit, debit, referenceId. Description, transaction type, and payment method are omitted. The importer automatically records credits as contributions and defaults payment method to cash.

Required ledger fields: an existing Passbook No. (preserve leading zeros), a valid transactionDate (YYYY-MM-DD recommended), and credit and debit amounts. Enter a positive amount in one amount column and zero in the other. Use up to two decimal places without currency signs or thousands separators. referenceId is optional; keep the same reference when re-uploading an entry. CSV uploads allow up to 1,000 entries and 1 MB per file.

Use a test dataset where these passbook numbers are available. The CSV adds credits to any existing balances; it does not reset balances. Import members first. Passbook numbers contain literal leading zeros; preserve the column as text if editing in Excel before saving as CSV UTF-8.

Validated with the application's member CSV parser and ledger CSV validator: 200 unique members, all 19 barangays, and 100 matching ledger entries without validation errors.
`);
console.log('Created and validated 200 members (0001-0200), 19 barangays, 100 ledgers (0001-0100), PHP 1,000 each.');
