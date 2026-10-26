# Daily transaction summary

Open **Member Ledger → Daily Summary**. The date defaults to today in Asia/Manila. Staff can refresh after recording or editing data, download PDF, print a summary, or download CSV. Completing a CSV upload refreshes the open summary automatically.

The authenticated Finance Officer endpoint is `GET /api/mortuary/treasurer/ledger/daily-summary?date=YYYY-MM-DD`. It uses the original ledger `transactionDate` with a half-open Philippine-midnight range, rather than upload or edit time. CSV date-only values stored at UTC midnight fall on the same Philippine date. Invalid dates are rejected.

The summary counts saved original ledger transactions only. Latest edits replace their original amounts without adding reversal rows or duplicate transaction counts. Edit reasons and audit history are not exported. Later edits restate the original transaction day. If reporting/audit completion is pending, the summary uses the saved ledger amount and displays a warning.

- **Total added:** positive ledger credits, including contributions and opening balances, using their latest edited amounts. This is a record of additions, not a cash collection total.
- **Members:** distinct passbook numbers with positive additions on the selected day.
- **Entries:** number of positive additions. Debit-only and zero-amount entries are excluded from the table, totals, member counts, PDF, and CSV.

The Reports-style document has a date picker that refreshes automatically, a Today shortcut, and a primary Download PDF action. The table shows passbook, member, reference, type, and amount added.

The table displays 50 transactions per page. Totals, PDF, CSV and print always cover the entire day. Empty days show zero totals and an empty-state message. Failed or stale requests cannot be printed or exported. Receipt references for legacy CSV payments are resolved using the existing payment-reference helper.

The service reads one day's original postings and their correction histories, not the whole ledger. A root-entry index supports correction lookup. Existing duplicate prevention at CSV import remains responsible for preventing duplicate postings; the summary does not silently merge distinct recorded transactions.

Tests:

- Server: `node --test tests/dailyLedgerSummary.test.js tests/mortuaryOfficerAccess.test.js`
- Client: `node --import ./tests/setup-dom.mjs --test --test-concurrency=1 tests/dailyLedgerSummary.test.mjs tests/treasurerLedgerNavigation.test.mjs`
