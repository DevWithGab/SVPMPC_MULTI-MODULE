# Daily ledger CSV uploads

Treasurer → Members Ledger → Bulk upload CSV is the daily transaction entry point. The Contributions navigation tab has been removed; its old URL opens Member Ledger. Contribution history remains available to dashboards and reports.

Required columns: `Passbook No.`, `transactionDate` (`YYYY-MM-DD`), `credit`, `debit`.
Optional column in the template: `referenceId`.

For payments from the external collection system, use a positive credit, zero debit, and its original receipt/transaction reference. Credits default to `contribution`, debits to `payout`, payment method to `cash`, and description to `Bulk upload`.

```csv
Passbook No.,transactionDate,credit,debit,referenceId
000123,2026-10-26,100.00,0.00,OR-20261026-001
```

Older CSVs with `description`, `transactionType`, and `paymentMethod` remain supported. An opening balance that should not count as a newly collected payment still needs `transactionType=adjustment` in a legacy CSV; the simplified template is for daily transactions.

1. Choose the CSV and preview every row.
2. Already recorded rows and repeated copies in the file are duplicates, not validation errors. Keep them in the file; only ready rows are imported.
3. The result shows recorded, duplicate—not recorded, and failed counts. An all-duplicate file has nothing new to import.
4. Append the next day's transactions to the same CSV or upload a separate CSV. Keep existing transaction references unchanged.

The same member/reference pair identifies one transaction. Reusing it with different dates, amounts, or transaction types is a conflict; the importer never overwrites an existing transaction. Separate genuine transactions must have separate references. Legacy rows without references match on member, date, credit, and debit, so use references to distinguish multiple equal payments on the same day. Changes to descriptive text alone do not create another transaction. Duplicate explicit `ledgerId` values are skipped only when the transaction details match.

Unknown members, invalid dates/amounts, and conflicting references block new writes until corrected. Runtime save failures are shown per row. Preview and import the same file again after a failure or lost response: saved transactions are skipped. A contribution whose ledger credit succeeded but payment-history write failed is marked Ready to finish; retry completes history without another credit.

New imports have a stable `Ledger.importKey` protected by a sparse unique index, and deterministic generated ledger IDs. Existing ledger rows are checked before writes. Overlapping imports and the existing payment entry services share ordered in-process member locks. This protects running balances within one server process; cross-process running-balance serialization and other writers retain the application's existing limitations. The MongoDB unique indexes must be enabled for database-level duplicate protection.

New contribution credits create idempotent Contribution history records with the uploaded transaction date, so dashboards and reports include them. Adjustments and other ledger transaction types do not create contribution history. The authenticated operator is stored on new ledger entries. No historical records are rewritten or deleted.

Validation: `node --test tests/ledgerImport.test.js` in `server`; `node --import ./tests/setup-dom.mjs --test tests/ledgerUpload.test.mjs` in `client`.
