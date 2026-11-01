# Concurrent ledger posting

All live financial appends use `createLedgerPostingService({ Ledger }).postLedgerEntry()`:
manual contributions, payment CSVs, ledger CSVs, claim deductions, blanket deductions,
opening registration entries, and amount corrections.

Each new ledger row names its predecessor in `postingParent`. A unique partial
index on `(memberId, postingParent)` permits only one successor to that head.
A competing writer rereads the latest head and recalculates its running balance.
The transaction, balance, and predecessor are inserted in one atomic document write.
Standalone MongoDB is supported; no transaction, expiring lease, separate balance
document, or process-local lock is required.

Stable `ledgerId` values make a retried posting return the saved row. Reusing an ID
with different financial details is rejected. Amount corrections additionally compare
the expected balance on every attempt and return 409 if another transaction changed
it. A storage failure creates no separate reserved balance; an uncertain write can
be retried using the same transaction ID.

Posting timestamps increase strictly after the previous head, so current-balance
queries and statement ordering remain compatible with existing records. Legacy rows
do not need a balance migration or a predecessor field.

## Deployment

Stop all older API instances before starting the updated instances. Older binaries
do not supply `postingParent` and must not write alongside updated ones. Startup
creates the required unique index before listening for requests and fails if index
creation fails. The database account needs index-creation permission.
Startup also creates an index matching the member's latest-posting lookup, including
its `_id` tie-breaker, to avoid sorting the full history for every append.

Use this posting service for future financial appends. Backup restoration, hard
deletion, and balance-repair scripts are maintenance operations: stop financial
writes before running them. This change does not make live backup merging atomic.

## Verification

Run `node --test tests/ledgerPosting.test.js` in `server/` for unit regressions.
For the multi-process check, explicitly set `TEST_MONGODB_URI` to a development
MongoDB server and run:

```text
node --test tests/integration/ledgerPosting.integration.js
```

The integration test does not load application `.env`. It creates a randomly named
isolated database, starts seven independent Node processes, forces competing head
reads, checks every intermediate balance, and removes its database afterwards.
