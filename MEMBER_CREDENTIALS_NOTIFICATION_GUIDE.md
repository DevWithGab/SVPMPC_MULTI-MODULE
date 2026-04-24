# 📧 Member Credentials Notification System

## Overview

When members are created (single or bulk CSV upload), the system automatically:
1. ✅ Generates secure random credentials
2. ✅ Sends credentials via **Email** (automatic)
3. ✅ Sends credentials via **SMS** (optional, if configured)

---

## 🎯 Features

### Automatic Email Notifications
- **Professional HTML email** with cooperative branding
- **Security warnings** about temporary passwords
- **Login instructions** with direct link to portal
- **Sent automatically** for both single and bulk member creation

### Optional SMS Notifications
- **SMS notifications** for single member creation (if configured)
- **Disabled by default** for bulk uploads (to avoid high SMS costs)
- **Can be enabled** in environment variables

---

## 📋 Sample CSV File

A sample CSV file has been created: `sample_members.csv`

### CSV Format

```csv
memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender
Juan Dela Cruz,juan.delacruz@example.com,09171234567,Barangay San Jose,123 Main Street,Maria Dela Cruz (Wife),1985-05-15,male
```

### Required Fields
- `memberName` - Full name of the member
- `email` - Email address (must be unique)
- `phoneNumber` - Philippine mobile number (09XXXXXXXXX)
- `barangay` - Barangay name
- `address` - Complete address

### Optional Fields
- `beneficiaries` - Beneficiary information
- `dateOfBirth` - Format: YYYY-MM-DD
- `gender` - male/female

---

## ⚙️ Email Configuration

### Using Gmail (Recommended for Testing)

1. **Create a Gmail App Password:**
   - Go to Google Account Settings
   - Security → 2-Step Verification → App Passwords
   - Generate a new app password for "Mail"

2. **Add to `.env` file:**

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-digit-app-password
APP_URL=http://localhost:5173

# SMS Configuration (Optional)
SEMAPHORE_API_KEY=your-semaphore-api-key
SMS_SENDER_NAME=SVPMPC
```

### Using Other Email Providers

Update `server/shared/services/notificationService.js`:

```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
```

---

## 📱 SMS Configuration (Optional)

### Using Semaphore SMS (Philippine Provider)

1. **Sign up at:** https://semaphore.co/
2. **Get your API Key** from the dashboard
3. **Add to `.env` file:**

```env
SEMAPHORE_API_KEY=your-api-key-here
SMS_SENDER_NAME=SVPMPC
```

### SMS Behavior

- **Single Member Creation:** SMS sent if API key is configured
- **Bulk CSV Upload:** SMS disabled by default (to avoid costs)
- **Can be enabled** by modifying the controller

---

## 🚀 How It Works

### 1. Single Member Creation

**Super Admin Portal → Add Member**

```javascript
// Automatic process:
1. Member record created
2. User account created with random password
3. Email sent with credentials ✅
4. SMS sent if configured ✅
5. Credentials shown in success message
```

**Email Content:**
- Welcome message
- Member ID, Username, Temporary Password
- Security warnings
- Login instructions
- Direct link to portal

### 2. Bulk CSV Upload

**Super Admin Portal → Bulk Upload**

```javascript
// Automatic process:
1. Parse CSV file
2. Create all member records
3. Create user accounts with random passwords
4. Send emails to all members (with 500ms delay between sends) ✅
5. Return summary with credentials
```

**Notification Strategy:**
- **Email:** Sent to all successful members
- **SMS:** Disabled by default (can be enabled)
- **Delay:** 500ms between sends to avoid rate limiting

### 3. Password Reset

**Super Admin Portal → Reset Password**

```javascript
// Automatic process:
1. Generate new random password
2. Update user account
3. Send password reset email ✅
4. Show new credentials to admin
```

---

## 📧 Email Templates

### Welcome Email (New Member)

```
Subject: Your SVPMPC Account Credentials

Dear [Member Name],

Your member account has been created successfully.

Login Credentials:
- Member ID: MEM-XXXXXXXXX
- Username: username
- Temporary Password: RandomPass123!

⚠️ Important: Change this password on first login.

[Login to SVPMPC Button]
```

### Password Reset Email

```
Subject: SVPMPC Password Reset

Dear [Member Name],

Your password has been reset by an administrator.

New Credentials:
- Username: username
- New Temporary Password: NewRandomPass456!

⚠️ Please change this password immediately after logging in.
```

---

## 🧪 Testing

### Test Email Notifications

1. **Configure email in `.env`:**
```env
EMAIL_USER=your-test-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

2. **Create a test member:**
   - Go to Super Admin portal
   - Click "Add Member"
   - Use your real email address
   - Submit form

3. **Check your inbox:**
   - You should receive a professional email with credentials
   - Check spam folder if not received

### Test Bulk Upload

1. **Use the sample CSV:**
   - Edit `sample_members.csv`
   - Replace email addresses with your test emails

2. **Upload via Super Admin:**
   - Click "Bulk Upload"
   - Select the CSV file
   - Submit

3. **Check results:**
   - All test emails should receive credentials
   - Check console logs for notification status

---

## 🔍 Monitoring & Logs

### Console Logs

The system logs all notification attempts:

```bash
✅ Email sent to juan.delacruz@example.com: <message-id>
✅ SMS sent to 09171234567
⚠️  SMS not configured. Skipping SMS notification.
❌ Error sending email to invalid@email.com: Invalid recipient
```

### API Response

The API returns notification results:

```json
{
  "message": "Member created successfully",
  "member": { ... },
  "account": {
    "username": "juan.delacruz1234",
    "temporaryPassword": "RandomPass123!"
  },
  "notifications": {
    "email": {
      "success": true,
      "messageId": "<message-id>"
    },
    "sms": {
      "success": false,
      "error": "SMS not configured"
    }
  }
}
```

---

## 🛠️ Troubleshooting

### Email Not Sending

**Problem:** Emails not being received

**Solutions:**
1. Check `.env` configuration
2. Verify Gmail app password (not regular password)
3. Check spam/junk folder
4. Enable "Less secure app access" (if using old Gmail)
5. Check console logs for error messages

### SMS Not Sending

**Problem:** SMS not being sent

**Solutions:**
1. Verify `SEMAPHORE_API_KEY` in `.env`
2. Check Semaphore account balance
3. Verify phone number format (09XXXXXXXXX)
4. Check console logs for API errors

### Rate Limiting

**Problem:** Some emails fail during bulk upload

**Solutions:**
1. Increase delay between sends (currently 500ms)
2. Use a dedicated email service (SendGrid, AWS SES)
3. Process in smaller batches

---

## 🔒 Security Best Practices

### Password Generation
- ✅ 12 characters minimum
- ✅ Mix of uppercase, lowercase, numbers, symbols
- ✅ Cryptographically random
- ✅ Marked as temporary (must change on first login)

### Email Security
- ✅ Use app passwords, not account passwords
- ✅ Store credentials in environment variables
- ✅ Never commit `.env` to version control
- ✅ Use TLS/SSL for email transport

### SMS Security
- ✅ API keys in environment variables
- ✅ Rate limiting to prevent abuse
- ✅ Disabled by default for bulk operations

---

## 💰 Cost Considerations

### Email
- **Gmail:** Free (with daily limits)
- **SendGrid:** Free tier available (100 emails/day)
- **AWS SES:** $0.10 per 1,000 emails

### SMS
- **Semaphore:** ₱0.50 - ₱1.00 per SMS
- **Bulk uploads:** Disabled by default to avoid unexpected costs
- **Recommendation:** Enable only for single member creation

---

## 🎯 Production Recommendations

### For Email
1. Use a dedicated email service (SendGrid, AWS SES, Mailgun)
2. Set up SPF, DKIM, DMARC records
3. Use a custom domain (noreply@svpmpc.com)
4. Monitor bounce rates and deliverability

### For SMS
1. Use a reliable SMS gateway (Semaphore, Twilio)
2. Set up rate limiting
3. Monitor costs and usage
4. Consider SMS only for critical notifications

### For Bulk Operations
1. Process in batches (100-500 at a time)
2. Use a queue system (Bull, RabbitMQ)
3. Implement retry logic for failed sends
4. Log all notification attempts

---

## 📊 Sample CSV File Location

**File:** `sample_members.csv` (in project root)

**Contains:** 20 sample members with realistic Philippine data

**Usage:**
1. Edit the file with real member data
2. Keep the header row unchanged
3. Upload via Super Admin → Bulk Upload

---

## 🔗 Related Files

- `server/shared/services/notificationService.js` - Notification logic
- `server/shared/controllers/adminController.js` - Member creation with notifications
- `sample_members.csv` - Sample CSV template
- `.env` - Configuration (create from `.env.example`)

---

## 📞 Support

For issues or questions:
1. Check console logs for error messages
2. Verify `.env` configuration
3. Test with a single member first
4. Review this guide for troubleshooting steps

---

**Last Updated:** 2024
**Version:** 1.0.0
