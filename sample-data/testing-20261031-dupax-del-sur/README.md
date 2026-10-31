# Dupax del Sur sample import data

1. Upload 01-members-200.csv through SuperAdmin > Bulk Upload.
2. Upload 02-opening-ledger-100.csv through Mortuary > Treasurer > Member Ledger > Bulk Upload.

The member file contains 200 fictional Filipino names with passbook numbers 0001 through 0200. Addresses use all 19 barangays supplied by the user, in Dupax del Sur, Nueva Vizcaya. Each barangay has 10 or 11 members. Emails use example.com; optional phone and beneficiary fields are blank.

The ledger file has 100 opening credits dated 2026-10-31, for passbooks 0001 through 0100. Each has a PHP 1,000.00 credit and zero debit (PHP 100,000.00 total). On members with no existing transactions, this produces a PHP 1,000.00 balance each. Passbooks 0101 through 0200 have no opening ledger entries.

Ledger columns match the current template: Passbook No., transactionDate, credit, debit, referenceId. Description, transaction type, and payment method are omitted. The importer automatically records credits as contributions and defaults payment method to cash.

Required ledger fields: an existing Passbook No. (preserve leading zeros), a valid transactionDate (YYYY-MM-DD recommended), and credit and debit amounts. Enter a positive amount in one amount column and zero in the other. Use up to two decimal places without currency signs or thousands separators. referenceId is optional; keep the same reference when re-uploading an entry. CSV uploads allow up to 1,000 entries and 1 MB per file.

Use a test dataset where these passbook numbers are available. The CSV adds credits to any existing balances; it does not reset balances. Import members first. Passbook numbers contain literal leading zeros; preserve the column as text if editing in Excel before saving as CSV UTF-8.

Validated with the application's member CSV parser and ledger CSV validator: 200 unique members, all 19 barangays, and 100 matching ledger entries without validation errors.
