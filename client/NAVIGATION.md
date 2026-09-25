# Portal navigation and recovery

Portal URLs are `/mortuary/admin`, `/mortuary/treasurer`, `/attendance/admin`,
`/attendance/secretary`, and `/attendance/scanner_operator`. The existing
`/super-admin` entry remains available.

The `tab` query parameter selects a screen. Mortuary claim details use `claim`;
treasurer member ledgers use `member`; treasurer claim tabs use `claimsView`.
For example, `/mortuary/treasurer?tab=ledger&member=MEMBER-ID`.
Copying a URL, refreshing, and browser Back/Forward restore the selection.
Signed-out visitors log in first; matching-role login returns to the requested URL.
Backend authorization continues to govern access to records.

## Hosting

Configure the frontend host to serve `index.html` for unmatched frontend paths
(SPA history fallback). Keep `/api` and static assets outside that fallback.
Vite development and preview servers already handle this. The Express server is
currently API-only; it does not host the frontend build.

## Verification

Run `npm test` and `npm run build` in `client`.

With a running API and authorized accounts, check:

- Navigate between tabs, open a claim or member ledger, and use Back/Forward.
- Refresh a detail URL and confirm the same record opens.
- Open a bookmarked URL while signed out and log in with the matching role.
- Sign out and use Back: authenticated portal content must not reopen.
- Disconnect the API, refresh a list, and confirm an error with Retry appears.
- Reconnect and retry: retained records refresh and the error clears.
- Interrupt a later ledger/contribution page: partial results must not replace
  the previously loaded complete list.

The contribution charts show paid contributions over six calendar months in
Philippine time. Cumulative contributions exclude opening balances and outflows;
the separate balance card comes from active members' latest ledger balances.
Contribution and ledger reads retrieve every page before replacing displayed data.
For very large histories, move chart totals to a server aggregation and paginate
the contribution table independently to reduce initial loading time.
