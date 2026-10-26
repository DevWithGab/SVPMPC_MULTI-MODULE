# Ledger amount corrections

Finance Officer (including legacy Treasurer) and Super Admin can use **Correct entry** in a member's ledger. The action accepts a positive amount with up to two decimals and a required reason of 10–500 characters. It shows the old amount, replacement amount, and resulting balance before confirmation. There is no separate approval step.

Eligible entries are contribution credits and the member's first ledger posting when it is an adjustment credit (opening balance). Later replacement entries can themselves be corrected. Claim deductions, payouts, penalties, other adjustments, dates, and member identities cannot be edited through this action. A payment must resolve unambiguously to a paid Contribution record; missing or inconsistent payment history must be repaired first.

## Posting and reporting

The original ledger row is never rewritten or deleted. A deterministic `CORR-...` ledger posting has `correctionOf` pointing to its predecessor and embedded correction metadata: root entry, original type, old/new amounts, reason, actor, linked contribution ID, and completion state.

Both correction legs live in this **single atomic MongoDB document**: debit reverses the old amount and credit supplies the new amount. The member ledger expands it into a reversal and a replacement line, with separate running balances, on the correction's posting date. Its stored transaction date preserves the original date for CSV matching. Pagination counts database postings; each correction expands to two display lines. CSV/PDF statements include both lines. The gross credit/debit totals include reversals; their difference is the net change.

The existing Contribution amount is updated, retaining its identity and payment date, so reports count one corrected payment. The immutable ledger entries and audit event retain the original amount. Opening-balance corrections do not update contributions.

## Failure handling

The same per-member payment lock used by imports serializes corrections within a server process. A deterministic unique ledger ID and sparse unique `correctionOf` index prevent duplicate successors, including concurrent copies of the same request. The server checks the displayed amount and current balance before a new posting, rejecting stale previews.

If payment reporting, audit recording, or the completion marker fails after the balance is saved, the endpoint returns `saved: true`. The replacement displays **Finish correction**. Retrying uses the saved actor and reason and completes reporting/audit without another posting. No new correction of that replacement is allowed until completion. A lost response can be retried with the same amount and reason. Conflicting attempts require refreshing and selecting the latest replacement.

As with existing payment/import writers, the in-process lock does not serialize unrelated postings across multiple server processes. The application does not use replica-set transactions. Ledger and report/audit updates are separate writes, and reports can temporarily retain the old amount until **Finish correction** succeeds. Do not describe those separate writes as an atomic database transaction.

## CSV uploads

The original reference stays reserved. Uploading the original CSV skips its existing entry; a changed amount with the same reference gives an error directing staff to **Correct entry**. A reference-free row exactly matching a known corrected amount/date is also skipped. Use stable receipt references: changing both the reference and transaction details cannot reliably be distinguished from a genuinely new payment.

Backups include correction metadata as part of ledger documents and the corresponding audit events. No live records are migrated by this change.

## Tests

- Server: `node --test tests/ledgerCorrection.test.js tests/ledgerImport.test.js tests/ledgerReferences.test.js tests/mortuaryOfficerAccess.test.js`
- Client: `node --import ./tests/setup-dom.mjs --test --test-concurrency=1 tests/ledgerCorrection.test.mjs tests/memberLedgerPdf.test.mjs tests/ledgerUpload.test.mjs`
- Client build: `npm run build`
