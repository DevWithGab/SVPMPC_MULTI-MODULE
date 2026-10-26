# Ledger amount editing

Finance Officer (including legacy Treasurer) and Super Admin can choose **Edit amount** in a member ledger, enter a positive amount with at most two decimal places, review the balance change, and save. There is no reason field or separate approval step. The API accepts an optional note for compatibility with older clients and unfinished edits.

Only contribution credits and the first adjustment credit (opening balance) are eligible. Deductions, payouts, penalties, dates, and member identities remain protected. Payments must resolve to one paid Contribution record.

## Clean ledger and statements

Each original transaction appears once, at its latest amount, with its original date, reference, and description. All subsequent running balances are recalculated from the latest transaction amounts. Screen, CSV and PDF use this same statement data. No reversal rows, extra withdrawals, reasons, or correction-history labels appear on the statement. Pagination and totals count visible transactions rather than internal audit postings. Existing corrections from the previous workflow are folded into this view automatically without a database migration.

The implementation retains immutable internal correction postings to preserve original values and safe retries on standalone MongoDB. These are private history, not additional cash movements in the statement. The original posting and each change remain recoverable; Super Admin audit logs show old/new amounts, operator, and timestamp. A subsequent edit uses the latest revision while keeping the displayed transaction identity unchanged.

The linked Contribution amount is updated in place, keeping the original payment date and identity, so reports count one payment. Opening-balance changes do not affect contribution reporting.

## Concurrency, retries and CSV uploads

Before a new edit, the server validates the amount and current balance from the confirmation screen. Stale previews are rejected. A per-member process lock and deterministic unique correction IDs prevent duplicate copies of a request from changing the balance twice. As with the existing payment writers, unrelated writes across multiple server processes are not serialized by the process lock.

If payment reporting or audit logging fails after the balance is saved, **Finish edit** retries the saved operation without another balance adjustment. Reports can retain the prior amount until this completes. A new edit is blocked until the preceding one finishes. Legacy pending edits retain their original note and actor on retry.

The original CSV reference remains reserved. Re-uploading an old CSV cannot restore the old amount or create another credit. Changed amounts with an existing reference require **Edit amount**, not a silent CSV overwrite. Exact known reference-free edited amounts are also recognized; stable receipt references remain necessary to distinguish new payments from changed identities.

Backups retain the raw audit postings and metadata. The member-facing statement APIs provide the clean projected ledger; raw administrative backups intentionally retain full history.

## Verification

- Server: `node --test tests/ledgerCorrection.test.js tests/ledgerImport.test.js tests/ledgerReferences.test.js`
- Client: `node --import ./tests/setup-dom.mjs --test --test-concurrency=1 tests/ledgerCorrection.test.mjs tests/memberLedgerPdf.test.mjs`
- Client build: `npm run build`
