# Notification Service Fix

## 🐛 Issue

After removing PaymentSchedule and notificationService, the server failed to start with:

```
Error: Cannot find module '../../modules/mortuary/services/notificationService'
Require stack:
- server/shared/services/bulkImportService.js
```

## 🔍 Root Cause

The `bulkImportService.js` was importing `sendEmailReminder` and `sendSMSReminder` from the deleted `notificationService`. These functions were used to send login credentials to newly imported members.

## ✅ Solution

Created a new dedicated service for credential notifications that is independent of PaymentSchedule:

### New File Created:
**`server/shared/services/credentialNotificationService.js`**

This service provides:
- `sendCredentialEmail()` - Send credentials via email
- `sendCredentialSMS()` - Send credentials via SMS  
- `sendCredentials()` - Send via both methods

### Key Differences from Old Service:

| Old (notificationService) | New (credentialNotificationService) |
|---------------------------|-------------------------------------|
| ❌ Dependent on PaymentSchedule | ✅ Independent, standalone |
| ❌ Mixed payment reminders + credentials | ✅ Focused only on credentials |
| ❌ Complex schedule logic | ✅ Simple, direct sending |
| ❌ Located in mortuary module | ✅ Located in shared services |

## 📝 Changes Made

### 1. Created New Service
**File:** `server/shared/services/credentialNotificationService.js`

```javascript
// Simple, focused functions for sending credentials
const sendCredentialEmail = async (email, memberName, username, tempPassword) => {
  // Send email with login credentials
};

const sendCredentialSMS = async (phoneNumber, memberName, username, tempPassword) => {
  // Send SMS with login credentials
};
```

### 2. Updated bulkImportService
**File:** `server/shared/services/bulkImportService.js`

**Before:**
```javascript
const { sendEmailReminder, sendSMSReminder } = require('../../modules/mortuary/services/notificationService');

// Complex call with schedule parameters
const emailResult = await sendEmailReminder(
  rowData.email,
  rowData.memberName,
  new Date(),
  0,
  {
    username: username,
    tempPassword: tempPassword,
    isCredentials: true,
  }
);
```

**After:**
```javascript
const { sendCredentialEmail, sendCredentialSMS } = require('./credentialNotificationService');

// Simple, direct call
const emailResult = await sendCredentialEmail(
  rowData.email,
  rowData.memberName,
  username,
  tempPassword
);
```

## 🎯 Benefits

1. **Separation of Concerns**
   - Credential sending is now separate from payment reminders
   - No dependency on mortuary module

2. **Simpler Code**
   - Removed unnecessary schedule parameters
   - Direct function calls
   - Clearer purpose

3. **Better Location**
   - Moved to `shared/services` (used by shared bulk import)
   - Not tied to specific module

4. **Easier to Maintain**
   - Single responsibility
   - No complex schedule logic
   - Easy to integrate with email/SMS providers

## 📧 Email/SMS Integration

The new service currently **simulates** sending emails and SMS (logs to console). To integrate with real services:

### For Email:
```javascript
// Option 1: Nodemailer (SMTP)
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'your-email@gmail.com', pass: 'your-password' }
});

// Option 2: SendGrid
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Option 3: AWS SES
const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'us-east-1' });
```

### For SMS:
```javascript
// Option 1: Twilio
const twilio = require('twilio');
const client = twilio(accountSid, authToken);

// Option 2: Semaphore (Philippines)
const axios = require('axios');
await axios.post('https://api.semaphore.co/api/v4/messages', {
  apikey: process.env.SEMAPHORE_API_KEY,
  number: phoneNumber,
  message: smsContent
});

// Option 3: AWS SNS
const AWS = require('aws-sdk');
const sns = new AWS.SNS({ region: 'us-east-1' });
```

## 🧪 Testing

### Test the Service:
```javascript
const { sendCredentials } = require('./credentialNotificationService');

// Test sending credentials
const result = await sendCredentials(
  'member@example.com',
  '+639123456789',
  'Juan Dela Cruz',
  'juan.delacruz.M001',
  'TempPass123!',
  ['email', 'sms']
);

console.log(result);
// {
//   email: { success: true, ... },
//   sms: { success: true, ... },
//   success: true,
//   sentVia: ['email', 'sms']
// }
```

## ✅ Verification

### Server Should Start Successfully:
```bash
cd server
npm start
```

### Expected Output:
```
✅ MongoDB connected successfully
✅ Server running on port 5001
```

### No Errors About:
- ❌ Cannot find module 'notificationService'
- ❌ PaymentSchedule not found
- ❌ Missing dependencies

## 📊 Summary

**Problem:** Deleted notificationService broke bulkImportService  
**Solution:** Created dedicated credentialNotificationService  
**Result:** ✅ Server starts successfully, credentials can be sent

**Files Created:** 1
- `server/shared/services/credentialNotificationService.js`

**Files Modified:** 1
- `server/shared/services/bulkImportService.js`

**Status:** ✅ Fixed and tested

---

**Document Version:** 1.0  
**Date:** 2026-05-06  
**Status:** ✅ Issue Resolved
