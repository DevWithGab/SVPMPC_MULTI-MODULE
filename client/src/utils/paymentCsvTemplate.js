import { formatManilaDateISO } from './date.js';

export function buildPaymentCsvTemplate(now = new Date()) {
  const date = formatManilaDateISO(now);
  return `Passbook No.,amount,payment_date,reference_number,payment_method,notes\r\n000123,100.00,${date},RECEIPT-001,cash,Daily contribution\r\n`;
}
