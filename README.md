# SVPMPC Multi-Module Management System

This capstone project is a web-based management system for **Saint Vincent Parish Multi-Purpose Cooperative (SVPMPC)**. It brings two cooperative operations into one application: **member attendance monitoring** and **mortuary fund management**.

The modules share member records and user accounts. Staff use different portals according to their responsibilities, while administrators manage records, approvals, reports, and audit trails.

## Quick context for an AI assistant

You can copy this description into an AI conversation, or ask the AI to read this README before working on the project:

> This repository contains the SVPMPC cooperative management system, a JavaScript application with a React/Vite frontend and an Express/MongoDB backend. It has two modules: Attendance, for event approval, member QR codes, scanning, manual attendance, and reports; and Mortuary, for contributions, member ledgers, beneficiaries, death claims, deductions, and benefit releases. Both modules use shared Member and User models. The active frontend has staff portals for administrators, secretaries, scanner operators, and treasurers, plus a Super Admin area. Follow the current routes, controllers, and models when making changes. Preserve shared member data, role restrictions, claim status transitions, and ledger accounting rules. Read the relevant source files before assuming that older guides, backup components, or API helper functions describe active features.

## What the system does

### 1. Attendance module

The attendance module helps staff organize cooperative events and track which members attended.

- Maintain a member directory and generate member QR codes.
- Create events, submit them for approval, and manage their lifecycle.
- Let administrators approve or reject event requests.
- Record attendance using QR scanning or manual entry.
- View attendance lists, statistics, and reports.
- Manage QR activation separately from the member's cooperative status.
- Provide audit logs and attendance backup/restore tools.

A typical workflow is: register members, issue their QR codes, create and approve an event, record attendance at the event, then review or export reports. The event model supports `draft`, `pending_approval`, `rejected`, `cancelled`, `upcoming`, `active`, and `closed` states; allowed transitions are implemented in the event controller.

Members use their issued QR codes physically. The active React application does not provide an attendance member self-service portal.

### 2. Mortuary module

The mortuary module tracks member contributions and the cooperative's financial assistance when a member dies.

- Record contributions and maintain individual member ledgers.
- View balances, deductions, and financial reports.
- Maintain beneficiary information and its history.
- Register death claims and track documentary requirements.
- Approve or reject claims and pass approved claims to the treasurer.
- Assess contributions from active members for an approved claim.
- Release the benefit to the beneficiary and record a disbursement voucher number.
- Track low-balance notifications, audit activity, and backup/restore operations.

The main claim workflow is:

```text
Register claim and track requirements
                |
       pending_requirements
                |
         Admin approval ------> rejected (if rejected)
                |
        pending_deduction
                |
    Treasurer processes deduction
                |
        deduction_processed
                |
    Treasurer releases cash benefit
                |
             released
```

Approval adds an `approved` history entry and moves the claim to `pending_deduction`. Filing a claim marks the associated member as deceased. The claim stores snapshots of member and beneficiary details so later profile changes do not rewrite the original claim information.

## Users and responsibilities

| Role | Main responsibilities in the current application |
| --- | --- |
| Super Admin (`super_admin`) | Central member/account administration and bulk member import through the Super Admin area. |
| Administrator (`admin`) | Attendance administration and approvals; mortuary records, claim approvals, beneficiary maintenance, deduction settings, reports, and audit tools. |
| Secretary (`secretary`) | Attendance event preparation, member directory, manual attendance, and reports. |
| Scanner Operator (`scanner_operator`) | Attendance scanner portal and QR-based attendance recording. |
| Treasurer (`treasurer`) | Mortuary contributions, balances, ledgers, claim deductions, benefit releases, and financial reporting. |

The database also supports a `member` user role, but `client/src/App.jsx` currently routes to staff portals, not an active member portal. Some backend routes have different role combinations, so check the middleware on the specific endpoint before changing access behavior. A Super Admin account does not automatically bypass every route's authorization check.

## Core data and business rules

### Shared records

- **Member** holds cooperative identity, contact details, barangay/address, QR information, beneficiary details, module membership, and status.
- **User** holds login credentials, role, module information, and account status. Staff accounts use `staffId`; member accounts use `memberId`.
- **AuditLog**, **CredentialLog**, and **ImportOperation** support activity tracking, credential delivery records, and imports.
- Member status can be `active`, `inactive`, `deceased`, or `staff`. QR availability uses the separate `qrCodeActive` field. Disabling a QR code must not change a member's mortuary eligibility by changing their shared status.

### Mortuary accounting

- A member's balance comes from **Ledger** records, not a balance field on **Member**.
- Ledger balances are running totals: previous balance + credit - debit.
- The latest balance is determined by posting order (`createdAt`, then `_id`), not the user-entered `transactionDate`. See [ledgerBalance.js](server/modules/mortuary/utils/ledgerBalance.js).
- Claim deductions use the active administrator-configured **DeductionSetting**. The current claim-processing fallback is **PHP 25 per active member** if no setting exists.
- Deduction processing can produce negative member balances; do not silently exclude members simply because their balance is insufficient.
- The beneficiary's benefit is based on the amount assessed for the claim, capped at **PHP 50,000**. It is not the deceased member's personal ledger balance.
- Amounts above the benefit cap are treated as cooperative income. The shared calculation is in [claimBenefit.js](server/modules/mortuary/config/claimBenefit.js).
- Releasing a claim records the payout without subtracting it from the deceased member's personal contribution balance.
- Automatic threshold notifications check for balances crossing below **PHP 300**, **PHP 100**, and **PHP 0**. The threshold SMS service currently simulates delivery; a recorded success there does not establish delivery by a real SMS provider.

For example, a claim assessed at PHP 60,000 results in a PHP 50,000 benefit and PHP 10,000 retained income. A claim assessed at PHP 20,000 results in a PHP 20,000 benefit and no retained income.

## Technology and architecture

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Tailwind CSS 4 |
| UI and reports | Lucide icons, Recharts, Framer Motion, jsPDF/AutoTable |
| QR support | `qrcode.react`, `jsqr`, and backend `qrcode` |
| API client | Axios |
| Backend | Node.js, Express 5, CommonJS modules |
| Database | MongoDB with Mongoose 9 |
| Authentication | JWT bearer tokens and bcrypt password hashing |
| Imports and messaging | Multer, CSV parsing, Nodemailer, notification services |

```text
React pages and components
          |
Frontend hooks and API services
          | HTTP /api/*
Express routes and middleware
          |
Controllers and business services
          |
Mongoose models -> MongoDB
```

The frontend uses ES modules. The backend uses `require`/`module.exports`. This is a split client/server repository; install dependencies and run commands in each directory separately.

## Repository map

```text
client/
  src/
    App.jsx                 Application routes and portal selection
    pages/                  System selector, Super Admin, module portals
    components/attendance/  Attendance screens grouped by staff role
    components/mortuary/    Mortuary screens grouped by staff role
    components/shared/      Shared login, layout, and UI components
    hooks/                  Authentication, module data, and UI state hooks
    context/                Context definitions; verify active imports
    services/               Axios clients and API helpers
    utils/                  Navigation, reporting, dates, and other helpers
  tests/                    Frontend utility tests
  backup/                   Older components; not the active portal source
server/
  server.js                 Express setup and API route mounts
  configs/                  MongoDB connection
  middleware/               Authentication, authorization, validation, errors
  shared/                   Shared models, controllers, routes, and services
  modules/
    attendance/             Attendance models, routes, controllers, services
    mortuary/               Mortuary models, routes, controllers, accounting
  scripts/                  Seed and maintenance scripts
  backups/                  Existing backup files
sample-data/                Example member and ledger imports
```

Main API prefixes are `/api/auth`, `/api/admin`, `/api/attendance`, `/api/mortuary`, and `/api/audit`. `GET /health` provides a basic server health response. See [server.js](server/server.js) for the mounts and each module's `routes/` directory for individual endpoints.

## Running locally

Use Node.js and npm compatible with the versions locked in both package lockfiles, plus a running MongoDB instance. A recent Node.js 22 release is a practical baseline; dependency engine requirements remain authoritative.

### Backend

From the repository root, in PowerShell:

```powershell
cd server
npm ci
Copy-Item .env.example .env
New-Item -ItemType Directory -Path uploads -Force
```

Copy the example only when creating a new local `.env`; preserve an existing configuration. Set these values in `server/.env`:

```dotenv
PORT=5000
MONGODB_URI=mongodb://localhost:27017/svpmpc-multi-module
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRE=7d
NODE_ENV=development
```

Additional email and SMS settings are listed in [server/.env.example](server/.env.example). Delivery behavior depends on the specific notification service; configuring an SMS key alone does not implement the simulated threshold sender.

Start the API from `server/`:

```powershell
npm run dev
```

For a development database, `npm run seed` creates the predefined test accounts and can update existing staff identifiers. Review [seedUsers.js](server/scripts/seedUsers.js) before running it; it contains development credentials and is not a production account-provisioning procedure.

### Frontend

Open a second terminal from the repository root:

```powershell
cd client
npm ci
```

Create `client/.env` with:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
```

Then run:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The API health endpoint for this setup is `http://localhost:5000/health`.

**Port configuration matters:** the backend example defaults to port `5000`, while frontend API clients fall back to `http://localhost:5001/api`. The explicit `VITE_API_BASE_URL` above aligns them. Restart Vite after changing its environment file.

### Available checks

From `client/`:

```powershell
npm test
npm run lint
npm run build
```

The backend's `npm test` is currently a placeholder that exits with an error. These client commands do not establish that database workflows or financial operations work end to end; exercise the relevant portals against a development database when changing those features.

## Guidance for AI-assisted changes

1. Start with `client/src/App.jsx` and `server/server.js`, then trace the relevant portal, API service, route, controller, and model.
2. Treat shared Member and User changes as potentially affecting both modules.
3. Keep financial calculations and claim transitions consistent with the backend rules described above. Inspect both the dashboard/reporting code and the transaction controller when changing accounting behavior.
4. Preserve pagination and filtering contracts. A visible page of results is not necessarily the full dataset for a report or dashboard total.
5. Verify actual route protection. Legacy API routes coexist with role-specific routes, and some legacy endpoints lack the same authentication checks. Frontend portal restrictions alone do not establish backend authorization.
6. Inspect active imports before editing similarly named hooks, contexts, service helpers, or backup components. A helper's existence does not prove that a matching backend endpoint exists.
7. Keep credentials and real member information out of generated examples. Maintenance scripts include deletion, reset, and data repair operations; they are not required for ordinary startup.
8. Prefer current source code over historical implementation notes when they disagree, and update this README if the system's behavior changes.

## Additional project notes

- [Sample data and import order](sample-data/README.md)
- [Frontend API service notes](client/src/services/README.md)
- [Pagination guide](PAGINATION_GUIDE.md)
- [Aggregation performance guide](AGGREGATION_PERFORMANCE_GUIDE.md)
- [Threshold notification notes](THRESHOLD_NOTIFICATION_SUMMARY.md)
- [Existing testing guide](TESTING_GUIDE.md)
- [Maintenance script notes](server/scripts/README.md)

These supporting documents describe particular implementation stages. Check their instructions against the current code before applying them.
