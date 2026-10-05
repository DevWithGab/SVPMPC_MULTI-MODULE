# Daily payment CSV uploads

Treasurer → Contributions → **Bulk Upload CSV**. The existing **Record Payment** form remains available for individual payments.

1. Download the template and replace its example row with actual transactions.
2. Choose the CSV and select **Preview Payments**. Review member names, totals, errors and existing payments.
3. Fix all errors in the file and preview again. Select **Import Payments** when ready.
4. Review the recorded, skipped and failed counts. Payments refresh in the contribution list, dashboard and member ledgers.

Required headers: `member_id`, `amount`, `payment_date`, `reference_number`. Optional headers: `payment_method`, `notes`. Camel-case headers such as `memberId` are also accepted. IDs are matched exactly; preserve leading zeros. Dates use `YYYY-MM-DD`, amounts are positive decimal numbers with at most two decimal places, and the supported payment method is `cash`. Limit: 500 payments / 1 MB per file.

```csv
member_id,amount,payment_date,reference_number,payment_method,notes
ACTUAL-MEMBER-ID,100.00,2026-10-05,OR-20261005-001,cash,Daily contribution
```

Use a distinct receipt or transaction reference for each payment by the same member. Re-uploading an existing member/reference pair with the same amount, date and method skips it. A different amount, date or method is a conflict and must be resolved before importing. Members may make multiple payments on the same day using different references. Do not change references merely to retry an upload.

## Persistence and recovery

The authenticated treasurer endpoint is `POST /api/mortuary/treasurer/contributions/bulk-upload`, with `{ csv, action: "preview" | "import" }`. Validation runs on the server for both actions. A validation error prevents the whole file from starting; runtime write failures are reported per payment, while other rows can complete.

Each payment reserves an immutable `PaymentImport` record keyed by a hash of member ID and reference. Ledger and contribution IDs use the same stable key. The effective payment date is retained on the contribution; the ledger uses posting time, consistent with the manual payment flow. The original recording user is retained on the ledger.

This supports the project's standalone MongoDB setup without requiring replica-set transactions. The ledger credit and contribution history are separate writes. If the second write fails, the row is reported as needing retry and may already appear in the ledger. Previewing and importing the same file completes that history record without another credit. A lost HTTP response is handled the same way. Completed rows are skipped on retry.

Bulk and manual contribution recording share an in-process member lock. As with the existing running-balance architecture, this is not a distributed lock across multiple server processes or other ledger writers such as deductions. Deployments with concurrent ledger writers need a shared balance/transaction strategy before relying on cross-process serialization.

Run `npm test` in `server` for CSV validation and in-memory persistence/recovery tests. These tests do not connect to a live database.
