# Claim registration

The unique partial `one_non_rejected_claim_per_member` index reserves a member
across every supported non-rejected claim status, including `filing`. Rejected
claims are history and do not block refiling. The model and index share one
status list in `utils/claimEligibility.js`; status cannot be null.

Startup awaits this index before accepting requests. Existing duplicate
non-rejected claims cause startup to fail and require review; they are never
automatically rejected or deleted.

## Standalone MongoDB recovery

Registration is a durable workflow rather than a multi-document transaction:

1. Validate the member, real non-future death date, and a currently active
   beneficiary belonging to that member.
2. Insert the claim as `filing`, with its beneficiary snapshot and registration
   journal. The unique index decides concurrent eligibility.
3. Atomically set the shared member to `deceased` and disable its QR. Preserve
   unrelated profile fields.
4. Compare-and-set the claim to `pending_requirements` only after the member
   update succeeds. A `filing` claim cannot be reviewed, approved, or deducted.
5. Upsert one creation audit entry using a stable ID.

An interrupted operation may leave a visible `Registration Pending` claim. It
never reports registration success before the member update and ready transition
complete. The API resumes an identical request using its persisted request hash;
different details for an already reserved member receive 409. A successful retry
returns the existing claim instead of inserting another one.

Startup recovers unfinished registrations. While running, a bounded recovery
pass runs every 30 seconds, including pending creation audits. Recovery uses
the original beneficiary snapshot and actor recorded at acceptance, and is safe
across multiple API instances. Shutdown waits for the active recovery pass.

Older claims without a registration journal are not rewritten by recovery.
Their inconsistencies need review. Rejection retains the existing member-status
behavior; the registration form permits selecting a deceased member for refiling,
while the API remains authoritative about duplicate claims.

## Verification

Run `node --test tests/claimRegistration.test.js` in `server/`.
For real multi-process and hard-crash coverage, explicitly set `TEST_MONGODB_URI`
to a development MongoDB server and run:

```text
node --test tests/integration/claimRegistration.integration.js
```

The integration test never loads application `.env`. It creates and removes a
randomly named isolated database and leaves application records untouched.
