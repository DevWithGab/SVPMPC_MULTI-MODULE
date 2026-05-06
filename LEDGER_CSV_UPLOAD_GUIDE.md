# Member Ledger CSV Upload - Implementation Guide

## Paper to Digital Transformation

The cooperative's manual paper ledger has been digitized with the exact same format:

### Paper Ledger Format (5 Columns):
1. **Date** - Transaction date
2. **OR/DV Number** - Official Receipt (OR) for deposits / Disbursement Voucher (DV) for withdrawals
3. **Received** - Amount deposited/contributed
4. **Withdrawn** - Amount paid out/deducted
5. **Balance** - Running balance after transaction

## Backend Implementation ✅

### 1. Controller Function
**File**: `server/modules/mortuary/controllers/ledgerController.js`

Added `bulkUploadLedger` function that:
- Accepts an array of ledger entries
- Validates required fields (memberId, date, received/withdrawn)
- Verifies member exists in database
- Calculates running balance for each entry
- Creates ledger entries in bulk
- Returns success/failure results for each entry

### 2. API Route
**File**: `server/modules/mortuary/routes/treasurerRoutes.js`

Added route: `POST /api/mortuary/treasurer/ledger/bulk-upload`
- Protected by authentication and treasurer authorization
- Accepts JSON payload with ledgerEntries array

### 3. Client API Service
**File**: `client/src/services/api.js`

Added `treasurerAPI.bulkUploadLedger(ledgerEntries)` function

## CSV Format (Matches Paper Ledger)

The CSV should have columns matching the paper ledger format:

```csv
memberId,date,ref_no,received,withdrawn,balance,description
M001,2024-01-15,OR-001,500,0,500,Monthly contribution
M002,2024-01-15,OR-002,1000,0,1000,Initial deposit
M003,2024-01-20,DV-001,0,5000,0,Death benefit payout
```

### Required Fields:
- **memberId**: Member ID (must exist in database)
- **date**: Transaction date in YYYY-MM-DD format
- **ref_no**: OR/DV Number (Official Receipt or Disbursement Voucher number)
- **received**: Amount received/deposited (use 0 if withdrawal)
- **withdrawn**: Amount withdrawn/paid out (use 0 if deposit)
- **balance**: Running balance (can be calculated automatically by system)
- **description**: Transaction description

### Column Mapping (Paper → Digital):
- **Date** → `date`
- **OR/DV Number** → `ref_no`
- **Received** → `received`
- **Withdrawn** → `withdrawn`
- **Balance** → `balance`

### Notes:
- Use **OR-XXX** format for Official Receipts (deposits/contributions)
- Use **DV-XXX** format for Disbursement Vouchers (withdrawals/payouts)
- The system will auto-calculate balance if not provided
- One row per transaction

## Frontend Implementation ✅

### CSV Upload Component
**File**: `client/src/components/mortuary/treasurer/MemberLedger.jsx`

Features:
- Upload button in header
- Modal with file picker
- CSV preview (first 5 rows)
- Format example display
- Success/failure count
- Automatic page refresh after upload

### Usage:
1. Click "Bulk Upload CSV" button in Member Ledger tab
2. Select CSV file with paper ledger data
3. Preview first 5 rows to verify format
4. Click "Upload Ledger Entries"
5. System processes all entries and shows results

## Data Migration from Paper

### Step 1: Prepare CSV from Paper Records
Convert paper ledger entries to CSV format:
- One row per transaction line in the paper ledger
- Use exact OR/DV numbers from paper
- Copy amounts from Received and Withdrawn columns
- Include running balance from paper (or let system calculate)

### Step 2: Upload via Treasurer Portal
1. Login as Treasurer
2. Go to "Members Ledger" tab
3. Click "Bulk Upload CSV"
4. Select prepared CSV file
5. Review preview
6. Upload

### Step 3: Verify
- Check member balances match paper records
- Review transaction history for each member
- Print digital ledger and compare with paper

## Error Handling

The API returns detailed results:
```json
{
  "success": true,
  "message": "Processed 10 entries: 8 successful, 2 failed",
  "results": {
    "success": [...],
    "failed": [
      {
        "entry": {...},
        "reason": "Member M999 not found"
      }
    ],
    "total": 10
  }
}
```

Common errors:
- **Member not found**: MemberId doesn't exist in database
- **Missing required fields**: date, received, or withdrawn not provided
- **Invalid date format**: Use YYYY-MM-DD format
- **Invalid amounts**: received and withdrawn must be numbers

## Benefits of Digital Ledger

✅ **Exact same format** as paper ledger (5 columns)
✅ **Automatic balance calculation** - no manual math errors
✅ **Searchable** - find any transaction instantly
✅ **Printable** - generate official copies anytime
✅ **Backup** - never lose records
✅ **Audit trail** - track all changes
✅ **Real-time** - multiple people can view simultaneously
✅ **Reports** - generate summaries automatically
