# Daily transaction summary

Open **Member Ledger → Daily Summary**. The date defaults to today in Asia/Manila. Staff can refresh after recording or editing data, print a summary, or download CSV. Completing a CSV upload refreshes the open summary automatically.

The authenticated Finance Officer endpoint is `GET /api/mortuary/treasurer/ledger/daily-summary?date=YYYY-MM-DD`. It uses the original ledger `transactionDate` with a half-open Philippine-midnight range, rather than upload or edit time. CSV date-only values stored at UTC midnight fall on the same Philippine date. Invalid dates are rejected.

The summary counts saved original ledger transactions only. Latest edits replace their original amounts without adding reversal rows or duplicate transaction counts. Edit reasons and audit history are not exported. Later edits restate the original transaction day. If reporting/audit completion is pending, the summary uses the saved ledger amount and displays a warning.

- **Contributions recorded:** contribution credits only.
- **Deductions / withdrawals:** debit transactions other than adjustments, including payouts and penalties, with their types identified in the table.
- **Opening balances and other adjustments:** adjustment credits and debits, plus any non-contribution credits, kept separate from collections.
- **Net ledger change:** all included credits minus debits, including adjustments; this is not cash collected.
- **Members with transactions:** distinct passbook numbers, including inactive/deceased members with records on the selected day.

The table displays 50 transactions per page. Totals, CSV and print always cover the entire day. Empty days show zero totals and an empty-state message. Failed or stale requests cannot be printed or exported. Receipt references for legacy CSV payments are resolved using the existing payment-reference helper.

The service reads one day's original postings and their correction histories, not the whole ledger. A root-entry index supports correction lookup. Existing duplicate prevention at CSV import remains responsible for preventing duplicate postings; the summary does not silently merge distinct recorded transactions.

Tests:

- Server: `node --test tests/dailyLedgerSummary.test.js tests/mortuaryOfficerAccess.test.js`
- Client: `node --import ./tests/setup-dom.mjs --test --test-concurrency=1 tests/dailyLedgerSummary.test.mjs tests/treasurerLedgerNavigation.test.mjs`
