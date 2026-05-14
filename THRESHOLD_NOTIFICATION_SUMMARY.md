# Automatic Threshold Notification System - Quick Summary

**Status:** ✅ **FULLY IMPLEMENTED**  
**Date:** May 14, 2026

---

## 🎯 What It Does

Automatically sends SMS notifications to members when their mortuary fund balance crosses critical thresholds.

---

## 📊 The Three Thresholds

```
┌─────────────────────────────────────────────────────────────┐
│                    BALANCE THRESHOLDS                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ₱1000+ ████████████████████████████████  ✅ HEALTHY       │
│                                                              │
│  ₱300   ─────────────────────────────────  ⚠️  THRESHOLD 1 │
│         "Dear [Name], your balance is now ₱[Amount]..."     │
│         (Friendly reminder)                                  │
│                                                              │
│  ₱100   ─────────────────────────────────  🔴 THRESHOLD 2  │
│         "URGENT: Your balance is critically low..."          │
│         (Urgent alert)                                       │
│                                                              │
│  ₱0     ─────────────────────────────────  🚨 THRESHOLD 3  │
│         "CRITICAL: Your balance is NEGATIVE..."              │
│         (Immediate action required)                          │
│                                                              │
│  Negative ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ❌ OVERDUE        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works (Simple Flow)

```
1. TRANSACTION HAPPENS
   ├─ Treasurer records contribution
   └─ Treasurer triggers death deduction
   
2. BALANCE CHANGES
   Old Balance: ₱350
   New Balance: ₱250
   
3. SYSTEM CHECKS
   Did balance cross ₱300? ✅ YES
   
4. SEND SMS
   📱 "Dear Juan, your balance is now ₱250..."
   
5. SAVE RECORD
   ✅ Notification saved to database
```

---

## 📱 SMS Messages

### When balance drops below ₱300:
```
Dear Juan Dela Cruz, your mortuary fund balance is now ₱250.00. 
Please consider making a contribution to maintain your account. 
Thank you! - SVMPC Cooperative
```

### When balance drops below ₱100:
```
URGENT: Juan Dela Cruz, your mortuary fund balance is critically 
low at ₱75.00. Please make a contribution immediately to avoid 
account issues. - SVMPC Cooperative
```

### When balance goes negative:
```
CRITICAL: Juan Dela Cruz, your mortuary fund balance is NEGATIVE 
at ₱-25.00. Please settle your account immediately. Contact us 
for assistance. - SVMPC Cooperative
```

---

## 🎯 Key Features

### ✅ Automatic
- No manual work needed
- Triggers on every transaction
- Real-time monitoring

### ✅ Smart
- Won't spam members (30-day cooldown)
- Only sends when threshold is crossed
- Tracks notification history

### ✅ Reliable
- Saves all notifications to database
- Handles failures gracefully
- Can retry failed notifications

### ✅ Complete
- Works with contributions
- Works with deductions
- Works with bulk operations

---

## 📊 Example Scenarios

### Scenario 1: Single Member Contribution
```
Before: Juan has ₱350
Action: Death deduction of ₱25
After:  Juan has ₱325

Result: ❌ No SMS (didn't cross ₱300)
```

### Scenario 2: Crosses One Threshold
```
Before: Maria has ₱310
Action: Death deduction of ₱25
After:  Maria has ₱285

Result: ✅ 1 SMS sent (crossed ₱300)
Message: "Dear Maria, your balance is now ₱285..."
```

### Scenario 3: Crosses Multiple Thresholds
```
Before: Pedro has ₱400
Action: Large deduction of ₱500
After:  Pedro has -₱100

Result: ✅ 3 SMS sent
1. "Dear Pedro, your balance is now -₱100..." (₱300 threshold)
2. "URGENT: Pedro, your balance is critically low..." (₱100 threshold)
3. "CRITICAL: Pedro, your balance is NEGATIVE..." (negative threshold)
```

### Scenario 4: Duplicate Prevention
```
Day 1:
Before: Ana has ₱350
Action: Deduction of ₱100
After:  Ana has ₱250
Result: ✅ SMS sent (crossed ₱300)

Day 5:
Before: Ana has ₱250
Action: Deduction of ₱10
After:  Ana has ₱240
Result: ❌ No SMS (already notified within 30 days)
```

### Scenario 5: Death Deduction (100 Members)
```
Death Deduction: ₱25 for all members

Member A: ₱350 → ₱325  ❌ No SMS
Member B: ₱310 → ₱285  ✅ 1 SMS (crossed ₱300)
Member C: ₱120 → ₱95   ✅ 1 SMS (crossed ₱100)
Member D: ₱20 → -₱5    ✅ 1 SMS (went negative)
... (96 more members)

Total SMS Sent: Depends on how many crossed thresholds
```

---

## 🗄️ What Gets Saved

Every notification is saved to the database:

```javascript
{
  notificationId: "unique-id",
  memberId: "M001",
  memberName: "Juan Dela Cruz",
  phoneNumber: "+639123456789",
  thresholdType: "threshold_300",  // or "threshold_100" or "negative_balance"
  balance: 250.00,
  message: "Dear Juan Dela Cruz, your balance is now ₱250...",
  status: "sent",  // or "pending" or "failed"
  sentAt: "2026-05-14T10:30:00Z",
  triggeredBy: "deduction",  // or "contribution"
  transactionId: "ledger-entry-id",
  createdAt: "2026-05-14T10:30:00Z"
}
```

---

## 📡 Available APIs

### View Member's Notification History
```
GET /api/mortuary/treasurer/notifications/history/M001
```

### View All Notifications
```
GET /api/mortuary/treasurer/notifications/all
```

### View Statistics
```
GET /api/mortuary/treasurer/notifications/stats?days=30
```

### Retry Failed Notifications
```
POST /api/mortuary/treasurer/notifications/retry-failed
```

---

## 🔧 Configuration

### Current Settings:
- **Threshold 1:** ₱300 (High Warning)
- **Threshold 2:** ₱100 (Low Warning)
- **Threshold 3:** ₱0 (Negative Balance)
- **Cooldown Period:** 30 days
- **SMS Provider:** Simulated (logs to console)

### To Change Thresholds:
Edit `server/modules/mortuary/services/thresholdNotificationService.js`:
```javascript
const THRESHOLDS = {
  HIGH_WARNING: 300,    // Change this
  LOW_WARNING: 100,     // Change this
  NEGATIVE: 0           // Keep at 0
};
```

### To Change Cooldown Period:
Edit `hasBeenNotified()` function:
```javascript
createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                                         ^^
                                    Change this number (days)
```

---

## 🔌 SMS Provider Integration

### Current Status: **SIMULATED**
SMS messages are logged to console but not actually sent.

### To Enable Real SMS:

**Option 1: Semaphore (Recommended for Philippines)**

1. Sign up at https://semaphore.co/
2. Get API key
3. Add to `.env`:
   ```
   SEMAPHORE_API_KEY=your_api_key_here
   ```
4. Update `sendSMS()` function in `thresholdNotificationService.js`

**Option 2: Twilio**

1. Sign up at https://www.twilio.com/
2. Get credentials
3. Install: `npm install twilio`
4. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=your_number
   ```
5. Update `sendSMS()` function

---

## 📂 Files Involved

### Created:
1. `server/modules/mortuary/models/SMSNotification.js`
2. `server/modules/mortuary/services/thresholdNotificationService.js`
3. `server/modules/mortuary/controllers/smsNotificationController.js`

### Modified:
1. `server/modules/mortuary/controllers/contributionController.js`
2. `server/modules/mortuary/controllers/deductionController.js`
3. `server/modules/mortuary/models/index.js`
4. `server/modules/mortuary/routes/treasurerRoutes.js`

---

## 🧪 How to Test

### Quick Test:
1. Start server: `npm start`
2. Record a contribution that crosses ₱300
3. Check console for SMS message
4. View notification history via API

### Detailed Testing:
See `TESTING_GUIDE.md` for complete test cases

---

## ✅ What's Working

- [x] Automatic threshold detection
- [x] SMS message generation
- [x] Notification tracking
- [x] Duplicate prevention
- [x] Integration with contributions
- [x] Integration with deductions
- [x] API endpoints
- [x] Statistics and reporting
- [x] Error handling

---

## ⏳ What's Pending

- [ ] Real SMS provider integration (currently simulated)
- [ ] Admin UI to view notifications
- [ ] Email notifications (optional)
- [ ] Configurable thresholds via UI (optional)

---

## 🎉 Benefits

### For Members:
- ✅ Automatic reminders to maintain balance
- ✅ No need to check balance manually
- ✅ Clear, actionable messages

### For Treasurer:
- ✅ No manual reminder work
- ✅ Complete notification history
- ✅ Statistics and reporting
- ✅ Automatic compliance with policy

### For Cooperative:
- ✅ Enforces internal policy
- ✅ Reduces delinquent accounts
- ✅ Improves member engagement
- ✅ Audit trail for communications

---

## 📊 Statistics Example

After 30 days of operation:

```
Total Notifications: 150
├─ Sent: 145 (96.7%)
├─ Pending: 2 (1.3%)
└─ Failed: 3 (2.0%)

By Threshold:
├─ ₱300 threshold: 80 (53.3%)
├─ ₱100 threshold: 50 (33.3%)
└─ Negative balance: 20 (13.3%)

By Trigger:
├─ Death deductions: 120 (80%)
├─ Contributions: 30 (20%)
└─ Manual: 0 (0%)
```

---

## 🚀 Ready to Use!

The system is **fully implemented** and ready for testing. Once you integrate a real SMS provider, it will be ready for production use.

### Next Steps:
1. ✅ Test with simulated SMS (logs to console)
2. ⏳ Integrate real SMS provider (Semaphore/Twilio)
3. ⏳ Test with real phone numbers
4. ⏳ Deploy to production

---

## 📞 Support

For questions or issues:
1. Check `THRESHOLD_NOTIFICATION_SYSTEM.md` for detailed documentation
2. Check `TESTING_GUIDE.md` for testing procedures
3. Check `IMPLEMENTATION_STATUS.md` for implementation details

---

**Document Version:** 1.0  
**Last Updated:** May 14, 2026  
**Status:** ✅ Complete and Ready

---

## 🎯 Quick Reference

| Threshold | Amount | Message Type | Severity |
|-----------|--------|--------------|----------|
| High Warning | ₱300 | Friendly reminder | ⚠️ Warning |
| Low Warning | ₱100 | Urgent alert | 🔴 Urgent |
| Negative | < ₱0 | Critical action required | 🚨 Critical |

**Cooldown:** 30 days per threshold  
**SMS Provider:** Simulated (ready for integration)  
**Status:** ✅ Fully Implemented
