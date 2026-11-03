# Client utilities

Plain functions shared by the portal screens. Import each module directly
(there is no barrel file). Keep React out of this folder; hooks belong in
`src/hooks/` and components in `src/components/`.

## Reports and printed documents

| Module | Produces |
| --- | --- |
| `attendanceReport.js` | Attendance report CSV/PDF for the Secretary portal. |
| `mortuaryReportPdf.js` | Mortuary report PDFs, laid out by `cooperativeReportPdf.js`. |
| `memberLedgerPdf.js` | A member's ledger, for both printing and download. |
| `cooperativePdfLetterhead.js` | The letterhead every ledger and report PDF shares. |
| `reportCsvHeader.js` | The front matter placed above every report CSV table. |
| `auditExport.js` | Audit log exports for the Super Admin page. |
| `balanceNotice.js`, `cooperativeNotice.js` | Balance-threshold and cooperative notice letters. |
| `qrCardsPdf.js`, `qrCardBatch.js`, `memberDirectory.js` | Member QR cards, fetched in bounded batches. |

## Rules that must match the server

- `date.js` and `scannerSchedule.js` follow the API's Philippine
  time (Asia/Manila) handling. Change both sides together.
- `importHeaders.js`, `ledgerCsvTemplate.js` and `paymentCsvTemplate.js` define
  the CSV columns the import endpoints accept.
- `memberStanding.js` uses the same balance bands as the Mortuary dashboard
  API (`server/modules/mortuary/controllers/dashboardController.js`).
- `csvDate.js` mirrors `server/shared/utils/csvDate.js`; `client/tests/csvDate.test.mjs`
  checks both against the same inputs.
