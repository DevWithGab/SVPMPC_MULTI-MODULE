// Keep CSV column labels separate from the API's existing memberId field.
export const isPassbookHeader = header => ['passbookno', 'passbooknumber', 'memberid'].includes(String(header).toLowerCase().replace(/[^a-z0-9]/g, ''));
export const importHeaderLabel = header => isPassbookHeader(header) ? 'Passbook No.' : header;
export const normalizeImportHeader = header => isPassbookHeader(header) ? 'memberId' : header.trim();
