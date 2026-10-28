import { formatManilaDateISO } from './date.js';

export function buildLedgerCsvTemplate(now = new Date()) {
  const date = formatManilaDateISO(now);
  return `Passbook No.,transactionDate,credit,debit,referenceId\r\n000123,${date},100.00,0.00,RECEIPT-001\r\n`;
}
