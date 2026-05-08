# Balance Update Fix

## Issues Found

1. **Member balances not updating after contribution** - Frontend wasn't waiting for all data to refresh
2. **Fund Balance calculation incorrect** - Used MongoDB aggregation `$last` without sorting
3. **Total Collected mismatch** - Only counted current month contributions instead of all-time total

## Fixes Applied

### 1. Frontend - TreasurerPortal.jsx
**Fixed:** Made all fetch calls wait using `Promise.all()` with `await`

**Before:**
```javascript
fetchContributions();
fetchDashboardStats();
fetchMembers();
fetchLedger();
showToast('Contribution recorded.', 'success');
```

**After:**
```javascript
await Promise.all([
  fetchContributions(),
  fetchMembers(),
  fetchLedger(),
  fetchDashboardStats()
]);
showToast('Contribution recorded.', 'success');
```

Now the UI waits for all data to be fetched before showing the success message.

### 2. Backend - dashboardController.js
**Fixed:** Corrected fund balance calculation and total collected logic

**Issues with old code:**
- Used `$last` in aggregation without sorting by date
- `$last` doesn't guarantee the latest entry
- Total Collected only counted current month

**New implementation:**
```javascript
// Get fund balance (sum of all member balances from latest ledger entries)
const members = await Member.find({ status: 'active' });
let fundBalance = 0;
let lowBalanceCount = 0;

for (const member of members) {
  const latestLedger = await Ledger.findOne({ memberId: member.memberId })
    .sort({ transactionDate: -1, _id: -1 });
  
  const balance = latestLedger ? latestLedger.balance : 0;
  fundBalance += balance;
  
  if (balance < 1000) {
    lowBalanceCount++;
  }
}

// Get total contributions (all time)
const allContributions = await Contribution.aggregate([
  {
    $match: {
      status: 'paid'
    }
  },
  {
    $group: {
      _id: null,
      total: { $sum: '$amount' }
    }
  }
]);

const totalCollected = allContributions.length > 0 ? allContributions[0].total : 0;
```

## What Changed

### Fund Balance (Mortuary Fund)
- ✅ Now correctly sums the latest balance for each active member
- ✅ Properly sorts ledger entries by date and _id to get the most recent
- ✅ Matches the sum of all individual member balances

### Total Collected (Total Capital Pool)
- ✅ Now sums ALL paid contributions (all-time)
- ✅ Should match Fund Balance (assuming no payouts)
- ✅ Previously only counted current month

### Member Balances
- ✅ Now updates immediately after contribution
- ✅ Frontend waits for all data to refresh
- ✅ Shows correct balance in Member Balances tab and Member Ledger

## Result

After recording a contribution:
1. ✅ Contribution appears in Contributions list
2. ✅ Member's balance updates in Member Balances tab
3. ✅ Member's ledger shows new entry with updated balance
4. ✅ Mortuary Fund (fundBalance) updates
5. ✅ Total Capital Pool (totalCollected) updates
6. ✅ Both values should now match (if no payouts have been made)

## Testing

Try recording a contribution for Carlos Reyes:
- Amount: 200
- Check Member Balances - should show updated balance
- Check Member Ledger - should show new ledger entry
- Check Dashboard - Mortuary Fund and Total Capital Pool should match
