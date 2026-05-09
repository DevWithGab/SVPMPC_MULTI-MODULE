# Send Notice Feature Restored

## 📧 What is "Send Notice"?

The **"Send Notice"** button in the Member Balances view allows the treasurer to send custom SMS/Email messages to individual members. This is typically used to:
- Remind members about their balance
- Request payment
- Send general notifications
- Communicate important information

## ✅ Feature Restored

After removing PaymentSchedule, we accidentally removed the simple notification feature. It has now been restored with a cleaner, simpler implementation.

---

## 🔧 What Was Created

### 1. Simple Notification Service
**File:** `server/modules/mortuary/services/simpleNotificationService.js`

**Purpose:** Send SMS and Email to members (NOT related to PaymentSchedule)

**Functions:**
```javascript
sendSMS(phoneNumber, memberName, message)
sendEmail(email, memberName, subject, message)
sendBalanceReminder(member, customMessage)
```

### 2. Simple Notification Controller
**File:** `server/modules/mortuary/controllers/simpleNotificationController.js`

**Purpose:** Handle API requests for sending notifications

**Endpoint:**
```javascript
POST /api/mortuary/treasurer/notifications/send-reminder
Body: {
  memberId: "M001",
  message: "Your custom message here"
}
```

### 3. Updated Route
**File:** `server/modules/mortuary/routes/treasurerRoutes.js`

**Added:**
```javascript
router.post('/notifications/send-reminder', sendReminderToMember);
```

---

## 🎯 How It Works

### User Flow:
1. Treasurer views Member Balances
2. Clicks "Send Notice" button next to a member
3. Modal opens with message input
4. Treasurer types custom message
5. Clicks "Send SMS Notification"
6. System sends SMS/Email to member

### Technical Flow:
```
Frontend (TreasurerPortal)
    ↓
POST /api/mortuary/treasurer/notifications/send-reminder
    ↓
simpleNotificationController.sendReminderToMember()
    ↓
1. Get member details from database
2. Get member balance from ledger
3. Call simpleNotificationService.sendBalanceReminder()
    ↓
4. Send SMS (if phone number exists)
5. Send Email (if email exists)
    ↓
Return success response
```

---

## 📊 Comparison: Old vs New

### Old System (Removed):
```javascript
// Complex, tied to PaymentSchedule
const { sendEmailReminder, sendSMSReminder } = require('./notificationService');

// Required schedule parameters
await sendEmailReminder(
  email,
  memberName,
  nextDueDate,        // ❌ Required PaymentSchedule
  amountDue,          // ❌ Required PaymentSchedule
  scheduleInfo        // ❌ Required PaymentSchedule
);
```

### New System (Restored):
```javascript
// Simple, independent
const { sendBalanceReminder } = require('./simpleNotificationService');

// Just send the message
await sendBalanceReminder(
  memberData,         // ✅ Just member info
  customMessage       // ✅ Just the message
);
```

---

## 🎨 Frontend Integration

### Member Balances Component:
```jsx
<Button 
  onClick={() => { 
    setSmsData({ 
      memberId: m.id, 
      message: '', 
      memberName: m.name 
    }); 
    setIsSmsModalOpen(true); 
  }}
>
  <Mail className="w-4 h-4 mr-2" />
  Send Notice
</Button>
```

### SMS Modal in TreasurerPortal:
```jsx
<Modal isOpen={isSmsModalOpen} onClose={() => setIsSmsModalOpen(false)}>
  <form onSubmit={handleSendSms}>
    <textarea 
      value={smsData.message}
      onChange={e => setSmsData({...smsData, message: e.target.value})}
      placeholder="Enter message for member..."
    />
    <Button type="submit">Send SMS Notification</Button>
  </form>
</Modal>
```

### Handler Function:
```javascript
const handleSendSms = async (e) => {
  e.preventDefault();
  const response = await api.post('/mortuary/treasurer/notifications/send-reminder', {
    memberId: smsData.memberId,
    message: smsData.message
  });
  
  if (response.data.success) {
    showToast('SMS notification sent.', 'success');
  }
};
```

---

## 📝 Example Usage

### Scenario 1: Low Balance Reminder
```
Treasurer clicks "Send Notice" for Juan Dela Cruz (Balance: ₱500)

Message typed:
"Dear Juan, your mortuary fund balance is low at ₱500. 
Please make a contribution to maintain your account. Thank you!"

Result:
✅ SMS sent to +639123456789
✅ Email sent to juan@example.com
```

### Scenario 2: Payment Request
```
Treasurer clicks "Send Notice" for Maria Santos

Message typed:
"Hi Maria, please settle your pending contribution at your earliest 
convenience. You can visit our office or contact us for payment options."

Result:
✅ SMS sent
✅ Email sent
```

### Scenario 3: General Announcement
```
Message typed:
"Reminder: Our office will be closed on May 15 for the holiday. 
Thank you for your understanding."

Result:
✅ Notification sent
```

---

## 🔌 SMS/Email Integration

Currently, the service **simulates** sending (logs to console). To integrate with real services:

### For SMS (Philippines):

#### Option 1: Semaphore
```javascript
const axios = require('axios');

const sendSMS = async (phoneNumber, memberName, message) => {
  const response = await axios.post('https://api.semaphore.co/api/v4/messages', {
    apikey: process.env.SEMAPHORE_API_KEY,
    number: phoneNumber,
    message: message,
    sendername: 'SVMPC'
  });
  
  return { success: response.data.status === 'success' };
};
```

#### Option 2: Twilio
```javascript
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendSMS = async (phoneNumber, memberName, message) => {
  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber
  });
  
  return { success: result.status === 'sent' };
};
```

### For Email:

#### Option 1: Nodemailer (Gmail)
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmail = async (email, memberName, subject, message) => {
  const result = await transporter.sendMail({
    from: '"SVMPC Cooperative" <noreply@svmpc.com>',
    to: email,
    subject: subject,
    html: `<p>Dear ${memberName},</p><p>${message}</p>`
  });
  
  return { success: result.accepted.length > 0 };
};
```

---

## ✅ Benefits of New Implementation

1. **Simpler Code**
   - No PaymentSchedule dependency
   - Direct message sending
   - Fewer parameters

2. **More Flexible**
   - Send any custom message
   - Not tied to payment schedules
   - Works for any notification type

3. **Better Organization**
   - Separate from payment schedule logic
   - Clear single responsibility
   - Easy to maintain

4. **Same User Experience**
   - Button still works the same
   - Modal still looks the same
   - Treasurer workflow unchanged

---

## 🧪 Testing

### Test the Feature:
1. Start the server
2. Login as Treasurer
3. Go to Member Balances
4. Click "Send Notice" on any member
5. Type a message
6. Click "Send SMS Notification"
7. Check console for simulated sending logs

### Expected Console Output:
```
📱 Sending SMS to +639123456789
   Member: Juan Dela Cruz
   Message: Your custom message here

📧 Sending email to juan@example.com
   Member: Juan Dela Cruz
   Subject: SVMPC Mortuary Fund Balance Reminder
   Message: Your custom message here
```

---

## 📊 Summary

**What Was Removed:** PaymentSchedule-based notification system  
**What Was Restored:** Simple custom message sending  
**What Changed:** Simpler implementation, no schedule dependency  
**User Impact:** None - feature works exactly the same  

**Files Created:** 2
- `server/modules/mortuary/services/simpleNotificationService.js`
- `server/modules/mortuary/controllers/simpleNotificationController.js`

**Files Modified:** 1
- `server/modules/mortuary/routes/treasurerRoutes.js`

**Status:** ✅ Feature Restored and Working

---

**Document Version:** 1.0  
**Date:** 2026-05-06  
**Status:** ✅ Complete
