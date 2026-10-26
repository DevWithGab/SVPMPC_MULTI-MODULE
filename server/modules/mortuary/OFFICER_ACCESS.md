# Mortuary officer accounts

Mortuary has one username/password sign-in form. The authenticated account's role determines the workspace; no role selection or shared role password is required.

- **Claims Officer** (`claims_officer`): Dashboard, Claims, and Beneficiaries. Read-only member and fund context supports these screens. Cannot post payments, process financial deductions, edit finance settings, manage member records, or access backup/restore and audit logs.
- **Finance Officer** (`finance_officer`): existing Treasurer workspace and financial operations, including ledger CSV uploads. Cannot perform Claims Officer approvals or beneficiary changes.
- **Super Admin**: creates accounts under Staff Accounts → Attendance or Mortuary. Mortuary Audit Logs and Mortuary Backup & Restore are separate sections in the Super Admin hub. These operations also enforce Super Admin access on the server.

Use separate named accounts for each staff member. Multiple accounts can hold the same officer role. Account creation generates a temporary password and requires a password change on first sign-in.

## Existing accounts

Existing `treasurer` accounts retain Finance Officer access. Existing `admin` accounts assigned Mortuary retain Claims Officer access only within Mortuary; Attendance admin permissions are unchanged. Existing bookmarks resolve to the renamed workspaces. No account records or passwords are automatically changed.

Super Admin can edit a legacy account and save its new officer role. The editor assigns one system/role to an account; when an old account serves both systems, create a separate account for the other system before reassigning it. Saving access changes revokes existing sessions.

Existing `/mortuary/admin` and `/mortuary/treasurer` API paths remain for compatibility, but authorization follows the officer permissions above. New accounts cannot be created as Mortuary Admin or Treasurer.

## Verification

- Server: `node --test tests/mortuaryOfficerAccess.test.js tests/staffAccess.test.js tests/mortuaryOperatorIdentity.test.js tests/mortuaryMemberSecurity.test.js`
- Client: `node --import ./tests/setup-dom.mjs --test tests/mortuaryOfficers.test.mjs tests/browserNavigation.test.mjs tests/staffNavigation.test.mjs tests/treasurerLedgerNavigation.test.mjs tests/authSession.test.mjs`
- Client build: `npm run build`
