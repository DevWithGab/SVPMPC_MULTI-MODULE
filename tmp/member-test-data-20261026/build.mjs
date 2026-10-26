import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Workbook } from '@oai/artifact-tool';
import { parseMemberUpload } from '../../client/src/utils/memberBulkUpload.js';

const require = createRequire(import.meta.url);
const { parseLedgerCsv } = require('../../server/modules/mortuary/utils/ledgerCsv.js');
const { parsePaymentCsv } = require('../../server/modules/mortuary/utils/paymentCsv.js');
const Member = require('../../server/shared/models/Member.js');
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'sample-data/testing-20261026-50');
const names = [
  'Adrian Mendoza', 'Beatriz Navarro', 'Carlo Villanueva', 'Diana Salazar',
  'Emilio Soriano', 'Felisa Bautista', 'Gabriel Mercado', 'Helena Castillo',
  'Ismael Agustin', 'Josefina Pineda', 'Leandro Aquino', 'Maribel Santiago',
  'Nestor Valdez', 'Ofelia Manalo', 'Paolo Escobar', 'Rosalinda Cabrera',
  'Samuel Benitez', 'Teresa Fajardo', 'Vicente Ocampo', 'Yolanda Estrella',
  'Andres Alonzo', 'Bernadette Cordero', 'Crisanto Dizon', 'Dolores Enriquez',
  'Eduardo Fuentes', 'Flordeliza Galang', 'Gregorio Hidalgo', 'Imelda Ignacio',
  'Joaquin Jimenez', 'Leonora Katigbak', 'Manuel Lorenzo', 'Nerissa Macapagal',
  'Orlando Natividad', 'Patricia Oliveros', 'Rafael Padilla', 'Remedios Quiroz',
  'Sergio Robles', 'Teodora Sebastian', 'Urbano Tolentino', 'Veronica Ubaldo',
  'Wilfredo Ventura', 'Zenaida Yabut', 'Alfredo Zuniga', 'Carmelita Abad',
  'Danilo Balagtas', 'Elvira Concepcion', 'Francisco De Leon', 'Gloria Evangelista',
  'Hernando Flores', 'Leticia Gonzales',
];
const barangays = ['San Jose', 'Poblacion', 'San Isidro', 'Santa Cruz', 'San Vicente'];
const streets = ['Rizal', 'Mabini', 'Bonifacio', 'Luna', 'Jacinto'];
const memberHeaders = ['memberName', 'email', 'phoneNumber', 'barangay', 'address', 'beneficiaries', 'beneficiaryRelationship', 'beneficiaryContactNumber', 'dateOfBirth', 'gender', 'Passbook No.'];
const ledgerHeaders = ['Passbook No.', 'transactionDate', 'credit', 'debit', 'description', 'transactionType', 'referenceId', 'paymentMethod'];
const paymentHeaders = ['Passbook No.', 'amount', 'payment_date', 'reference_number', 'payment_method', 'notes'];
const memberRows = names.map((name, i) => [
  name, `test.20261026.member${String(i + 1).padStart(3, '0')}@example.com`,
  `0917600${String(i + 1).padStart(4, '0')}`, barangays[i % 5],
  `${101 + i} ${streets[i % 5]} Street, ${barangays[i % 5]}`,
  '', '', '', `${1965 + i % 22}-${String(i % 12 + 1).padStart(2, '0')}-${String(i % 27 + 1).padStart(2, '0')}`,
  i % 2 ? 'female' : 'male', String(905001 + i),
]);
const ledgerRows = memberRows.map((member, i) => [
  member[10], '2026-10-25', 1000, 0, 'Test opening balance', 'adjustment',
  `TEST-20261026-OPEN-${String(i + 1).padStart(3, '0')}`, 'cash',
]);
const paymentRows = memberRows.slice(0, 20).map((member, i) => [
  member[10], [100, 150, 200, 250, 300][i % 5], '10-26-2026',
  `TEST-20261026-PAY-${String(i + 1).padStart(3, '0')}`, 'cash', 'Test contribution after opening balance',
]);

const wb = Workbook.create();
const datasets = [
  { name: 'Members', file: '01-members-50.csv', headers: memberHeaders, rows: memberRows, money: [] },
  { name: 'Opening ledger', file: '02-opening-ledger-50.csv', headers: ledgerHeaders, rows: ledgerRows, money: [2, 3] },
  { name: 'Contributions', file: '03-contributions-20.csv', headers: paymentHeaders, rows: paymentRows, money: [1] },
];
for (const data of datasets) {
  const sheet = wb.worksheets.add(data.name);
  const range = sheet.getRangeByIndexes(0, 0, data.rows.length + 1, data.headers.length);
  range.values = [data.headers, ...data.rows];
}
wb.recalculate();

const escape = value => /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
for (const data of datasets) {
  const values = wb.worksheets.getItem(data.name).getRangeByIndexes(0, 0, data.rows.length + 1, data.headers.length).values;
  assert.equal(values.length, data.rows.length + 1);
  data.csv = '\uFEFF' + values.map((row, i) => row.map((cell, j) => escape(i && data.money.includes(j) ? Number(cell).toFixed(2) : String(cell ?? ''))).join(',')).join('\r\n') + '\r\n';
}

const parsedMembers = parseMemberUpload(datasets[0].csv).members;
const parsedLedger = parseLedgerCsv(datasets[1].csv);
const parsedPayments = parsePaymentCsv(datasets[2].csv);
assert.equal(parsedMembers.length, 50);
assert.equal(parsedLedger.length, 50);
assert.equal(parsedPayments.length, 20);
const ids = new Set(parsedMembers.map(member => member.passbookNo));
assert.equal(ids.size, 50);
assert.equal(new Set(parsedMembers.map(member => member.email)).size, 50);
for (const member of parsedMembers) {
  assert.match(member.phoneNumber, /^09\d{9}$/);
  assert.match(member.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  await new Member({ ...member, memberId: member.passbookNo, status: 'active' }).validate();
}
for (const row of [...parsedLedger, ...parsedPayments]) {
  assert.deepEqual(row.errors, []);
  assert.ok(ids.has(row.entry.memberId));
}
const ledgerTotal = parsedLedger.reduce((sum, row) => sum + row.entry.credit - row.entry.debit, 0);
const contributionsTotal = parsedPayments.reduce((sum, row) => sum + row.entry.amount, 0);
assert.equal(ledgerTotal, 50000);
assert.equal(contributionsTotal, 4000);
assert.equal(new Set([...ledgerRows.map(row => row[6]), ...paymentRows.map(row => row[3])]).size, 70);
// Compare against existing local sample files, without accessing the live database.
for (const filename of await fs.readdir(path.join(root, 'sample-data'))) {
  if (!filename.endsWith('.csv')) continue;
  const existing = await fs.readFile(path.join(root, 'sample-data', filename), 'utf8');
  for (const member of parsedMembers) {
    assert.ok(!existing.includes(member.passbookNo), `Existing sample passbook: ${member.passbookNo}`);
    assert.ok(!existing.includes(member.email), `Existing sample email: ${member.email}`);
  }
}
await fs.mkdir(output, { recursive: true });
for (const data of datasets) {
  const filename = path.join(output, data.file);
  await fs.writeFile(filename, data.csv, { encoding: 'utf8', flag: 'wx' });
  assert.equal(await fs.readFile(filename, 'utf8'), data.csv);
}
console.log(JSON.stringify({ output, files: datasets.map(data => ({ file: data.file, records: data.rows.length })), passbooks: ['905001', '905050'], openingBalanceEach: 1000, ledgerTotal, contributionsTotal, finalTotal: ledgerTotal + contributionsTotal, validation: 'All CSV parsers and Member schema passed. References match; no local sample ID/email overlap.' }, null, 2));
