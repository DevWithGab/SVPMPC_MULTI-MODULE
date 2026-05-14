# Testing Guide - Automatic Threshold Notification System

**Date:** May 14, 2026  
**Purpose:** Step-by-step guide to test the automatic threshold notification system

---

## 🎯 What We're Testing

The system should automatically send SMS notifications when a member's balance crosses these thresholds:
- **₱300** - High Warning (friendly reminder)
- **₱100** - Low Warning (urgent alert)
- **₱0** - Critical (negative balance)

---

## 🚀 Prerequisites

1. **Server Running**
   ```bash
   cd server
   npm start
   ```

2. **Database Connected**
   - MongoDB should be running
   - Check console for "MongoDB connected successfully"

3. **Test Member Available**
   - You need at least one active member in the system
   - Note their `memberId` (e.g., "M001")

---

## 📋 Test Cases

### Test Case 1: Cross ₱300 Threshold (High Warning)

**Scenario:** Member balance drops from ₱350 to ₱250

**Steps:**

1. **Check current balance:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/balance/M001
   ```
   
   Expected: Balance should be above ₱300 (e.g., ₱350)

2. **Record a contribution that brings balance below ₱300:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   Content-Type: application/json
   Authorization: Bearer <treasurer_token>
   
   {
     "memberId": "M001",
     "amount": -100
   }
   ```
   
   Note: Negative amount simulates a deduction for testing

3. **Check server console:**
   ```
   Expected output:
   📱 [THRESHOLD SMS] Sending to +639123456789
      Message: Dear [Member Name], your mortuary fund balance is now ₱250.00...
   ✅ threshold_300 notification created for [Member Name] (M001)
   ```

4. **Verify notification was created:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```
   
   Expected response:
   ```json
   {
     "success": true,
     "data": {
       "memberId": "M001",
       "notifications": [
         {
           "thresholdType": "threshold_300",
           "balance": 250,
           "status": "sent",
           "message": "Dear [Name], your mortuary fund balance is now ₱250.00..."
         }
       ],
       "count": 1
     }
   }
   ```

**✅ Pass Criteria:**
- Console shows SMS sending message
- Notification created in database
- Status is "sent"
- Threshold type is "threshold_300"

---

### Test Case 2: Cross ₱100 Threshold (Low Warning)

**Scenario:** Member balance drops from ₱150 to ₱50

**Steps:**

1. **Set up member with balance around ₱150**

2. **Record transaction that brings balance below ₱100:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": -100
   }
   ```

3. **Check server console:**
   ```
   Expected output:
   📱 [THRESHOLD SMS] Sending to +639123456789
      Message: URGENT: [Member Name], your mortuary fund balance is critically low at ₱50.00...
   ✅ threshold_100 notification created for [Member Name] (M001)
   ```

4. **Verify notification:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```

**✅ Pass Criteria:**
- Console shows URGENT message
- Notification created with threshold_100
- Message contains "critically low"

---

### Test Case 3: Negative Balance (Critical)

**Scenario:** Member balance goes from ₱50 to -₱50

**Steps:**

1. **Set up member with balance around ₱50**

2. **Record transaction that makes balance negative:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": -100
   }
   ```

3. **Check server console:**
   ```
   Expected output:
   📱 [THRESHOLD SMS] Sending to +639123456789
      Message: CRITICAL: [Member Name], your mortuary fund balance is NEGATIVE at ₱-50.00...
   ✅ negative_balance notification created for [Member Name] (M001)
   ```

4. **Verify notification:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```

**✅ Pass Criteria:**
- Console shows CRITICAL message
- Notification created with negative_balance
- Message contains "NEGATIVE"

---

### Test Case 4: Multiple Thresholds Crossed

**Scenario:** Member balance drops from ₱400 to -₱100 (crosses all three thresholds)

**Steps:**

1. **Set up member with balance ₱400**

2. **Record large deduction:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": -500
   }
   ```

3. **Check server console:**
   ```
   Expected output:
   📱 [THRESHOLD SMS] Sending to +639123456789 (3 times)
   ✅ negative_balance notification created
   ✅ threshold_100 notification created
   ✅ threshold_300 notification created
   ```

4. **Verify all notifications:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```
   
   Expected: 3 notifications created

**✅ Pass Criteria:**
- 3 separate SMS messages sent
- 3 notifications created in database
- Each has different threshold type

---

### Test Case 5: Duplicate Prevention

**Scenario:** Same threshold crossed twice within 30 days should only send 1 notification

**Steps:**

1. **First transaction - cross ₱300 threshold:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": -100
   }
   ```
   
   Expected: SMS sent ✅

2. **Second transaction - still below ₱300:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": -10
   }
   ```
   
   Expected: SMS skipped ⏭️

3. **Check server console:**
   ```
   Expected output:
   ⏭️ Skipping threshold_300 notification for M001 - already notified recently
   ```

4. **Verify only 1 notification exists:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```
   
   Expected: Only 1 threshold_300 notification (not 2)

**✅ Pass Criteria:**
- First transaction sends SMS
- Second transaction skips SMS
- Console shows "already notified recently"
- Only 1 notification in database

---

### Test Case 6: Death Deduction (Bulk)

**Scenario:** Death deduction triggers notifications for multiple members

**Steps:**

1. **Ensure you have multiple members with varying balances:**
   - Member A: ₱350 (won't cross threshold)
   - Member B: ₱310 (will cross ₱300)
   - Member C: ₱120 (will cross ₱100)
   - Member D: ₱20 (will go negative)

2. **Trigger death deduction:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/balances/automatic-deduction
   
   {
     "deceasedMemberName": "Test Member",
     "customAmount": 25
   }
   ```

3. **Check server console:**
   ```
   Expected output:
   📱 [THRESHOLD SMS] Sending to Member B's phone
   ✅ threshold_300 notification created for Member B
   
   📱 [THRESHOLD SMS] Sending to Member C's phone
   ✅ threshold_100 notification created for Member C
   
   📱 [THRESHOLD SMS] Sending to Member D's phone
   ✅ negative_balance notification created for Member D
   ```

4. **Verify notifications:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/all
   ```
   
   Expected: Multiple notifications created for different members

**✅ Pass Criteria:**
- Only members who crossed thresholds receive SMS
- Each member gets appropriate threshold notification
- Members who didn't cross thresholds don't get SMS

---

### Test Case 7: Balance Increase (No Notification)

**Scenario:** Member makes contribution that increases balance - should NOT trigger notification

**Steps:**

1. **Member has balance ₱250 (below ₱300)**

2. **Record contribution that increases balance:**
   ```bash
   POST http://localhost:5000/api/mortuary/treasurer/contributions/record
   
   {
     "memberId": "M001",
     "amount": 200
   }
   ```
   
   New balance: ₱450

3. **Check server console:**
   ```
   Expected output:
   (No threshold notification messages)
   ```

4. **Verify no new notification:**
   ```bash
   GET http://localhost:5000/api/mortuary/treasurer/notifications/history/M001
   ```
   
   Expected: No new notifications (balance increased, didn't cross threshold downward)

**✅ Pass Criteria:**
- No SMS sent
- No notification created
- Balance increased successfully

---

## 📊 View Notification Statistics

**Get overall statistics:**
```bash
GET http://localhost:5000/api/mortuary/treasurer/notifications/stats?days=30
```

Expected response:
```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "stats": {
      "total": 15,
      "sent": 14,
      "pending": 0,
      "failed": 1,
      "byThreshold": {
        "threshold_300": 8,
        "threshold_100": 5,
        "negative_balance": 2
      },
      "byTrigger": {
        "contribution": 3,
        "deduction": 12,
        "manual": 0
      }
    }
  }
}
```

---

## 🔍 Troubleshooting

### Issue: No SMS messages in console

**Check:**
1. Is `checkAndNotify()` being called?
   - Add console.log in contributionController/deductionController
2. Did balance actually cross threshold?
   - Check old balance vs new balance
3. Is member already notified?
   - Check notification history

### Issue: Notification created but status is "failed"

**Check:**
1. SMS sending function returned error
2. Check `failureReason` field in notification
3. Currently simulated, so should always succeed

### Issue: Duplicate notifications being sent

**Check:**
1. Is 30-day cooldown working?
2. Check `hasBeenNotified()` function
3. Verify notification timestamps

### Issue: Wrong threshold type

**Check:**
1. Verify balance values (old vs new)
2. Check `determineThresholdCrossed()` logic
3. Ensure thresholds are correct (300, 100, 0)

---

## 🧪 Quick Test Script

Use this to quickly test all scenarios:

```javascript
// test-thresholds.js
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/mortuary/treasurer';
const TOKEN = 'your_treasurer_token_here';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` }
});

async function testThresholds() {
  console.log('🧪 Testing Threshold Notifications...\n');
  
  // Test 1: Cross ₱300
  console.log('Test 1: Cross ₱300 threshold');
  await api.post('/contributions/record', {
    memberId: 'M001',
    amount: -100
  });
  console.log('✅ Test 1 complete\n');
  
  // Test 2: Cross ₱100
  console.log('Test 2: Cross ₱100 threshold');
  await api.post('/contributions/record', {
    memberId: 'M002',
    amount: -100
  });
  console.log('✅ Test 2 complete\n');
  
  // Test 3: Go negative
  console.log('Test 3: Negative balance');
  await api.post('/contributions/record', {
    memberId: 'M003',
    amount: -100
  });
  console.log('✅ Test 3 complete\n');
  
  // View statistics
  console.log('📊 Viewing statistics...');
  const stats = await api.get('/notifications/stats?days=1');
  console.log(stats.data);
  
  console.log('\n✅ All tests complete!');
}

testThresholds().catch(console.error);
```

Run with:
```bash
node test-thresholds.js
```

---

## ✅ Success Checklist

After running all tests, verify:

- [ ] ₱300 threshold triggers "Dear [Name]..." message
- [ ] ₱100 threshold triggers "URGENT..." message
- [ ] Negative balance triggers "CRITICAL..." message
- [ ] Multiple thresholds can be crossed in one transaction
- [ ] Duplicate notifications are prevented (30-day cooldown)
- [ ] Death deduction triggers notifications for multiple members
- [ ] Balance increases don't trigger notifications
- [ ] All notifications are saved to database
- [ ] Notification history API works
- [ ] Statistics API shows correct counts
- [ ] Console logs show SMS sending messages
- [ ] Transaction failures don't occur if notification fails

---

## 🎉 Expected Results

If all tests pass, you should see:

1. **Console Output:**
   - SMS sending messages for each threshold crossed
   - Notification creation confirmations
   - Skip messages for duplicates

2. **Database:**
   - SMSNotification collection populated
   - Correct threshold types
   - Proper status (sent/failed)
   - Links to triggering transactions

3. **API Responses:**
   - Notification history shows all notifications
   - Statistics show correct counts
   - Filters work properly

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Integrate Real SMS Provider**
   - Sign up for Semaphore or Twilio
   - Add API credentials to `.env`
   - Update `sendSMS()` function
   - Test with real phone numbers

2. **Monitor in Production**
   - Watch for failed notifications
   - Check SMS delivery rates
   - Monitor costs

3. **Gather Feedback**
   - Are members receiving notifications?
   - Are messages clear and helpful?
   - Any adjustments needed?

---

**Document Version:** 1.0  
**Last Updated:** May 14, 2026  
**Status:** Ready for Testing
