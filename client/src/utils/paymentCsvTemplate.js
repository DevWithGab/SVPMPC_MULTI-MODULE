import { formatManilaDateISO } from './date.js';

export function formatPaymentCsvDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return iso ? `${iso[2]}-${iso[3]}-${iso[1]}` : value;
}

export function buildPaymentCsvTemplate(now = new Date()) {
  const date = formatPaymentCsvDate(formatManilaDateISO(now));
  return `Passbook No.,amount,payment_date,reference_number,payment_method,notes\r\n000123,100.00,${date},RECEIPT-001,cash,Daily contribution\r\n`;
}
