# 📊 CSV Upload Quick Guide

## 🎯 Quick Answer to Your Questions

### Q: Does the member get their credentials via SMS or email when CSV is uploaded?

**A: YES! ✅**

When you upload a CSV file:
1. **Email notifications are sent automatically** to all successfully created members
2. **SMS notifications are optional** (disabled by default for bulk uploads to avoid high costs)
3. **Credentials are also shown in the upload results** so you can manually distribute them if needed

---

## 📋 Sample CSV File

**Location:** `sample_members.csv` (in project root)

**Format:**
```csv
memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender
Juan Dela Cruz,juan.delacruz@example.com,09171234567,Barangay San Jose,123 Main Street,Maria Dela Cruz (Wife),1985-05-15,male
Maria Santos,maria.santos@example.com,09182345678,Barangay Santa Cruz,456 Oak Avenue,Pedro Santos (Husband),1990-08-22,female
```

---

## 🚀 How to Use

### Step 1: Prepare Your CSV File

1. **Open** `sample_members.csv` or create a new one
2. **Keep the header row** exactly as shown:
   ```
   memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender
   ```
3. **Add your member data** (one member per row)
4. **Save** as CSV format

### Step 2: Configure Email (First Time Only)

1. **Edit** `server/.env` file:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-digit-app-password
   ```

2. **Get Gmail App Password:**
   - Go to Google Account Settings
   - Security → 2-Step Verification → App Passwords
   - Generate password for "Mail"
   - Copy the 16-digit password

### Step 3: Upload CSV

1. **Login** to Super Admin portal
   - Click "Super Admin Access" at bottom of login
   - Password: `SuperAdmin2024!`

2. **Click** "Bulk Upload" button

3. **Choose** your CSV file

4. **Preview** the data (first 5 rows shown)

5. **Click** "Upload Members"

### Step 4: What Happens Automatically

```
✅ Members created in database
✅ User accounts created with random passwords
✅ Emails sent to all members with their credentials
✅ Results shown with success/failure summary
```

---

## 📧 What Members Receive

### Email Content

**Subject:** Your SVPMPC Account Credentials

**Contains:**
- Welcome message
- Member ID
- Username
- Temporary Password
- Security warnings
- Login instructions
- Direct link to portal

**Example:**
```
Dear Juan Dela Cruz,

Your member account has been created successfully.

Login Credentials:
- Member ID: MEM-1234567890
- Username: juan.delacruz1234
- Temporary Password: aB3$xY9#mK2!

⚠️ Important: Change this password on first login.

[Login to SVPMPC Button]
```

---

## 📱 SMS Notifications (Optional)

### Current Setup
- **Single Member:** SMS sent if configured
- **Bulk Upload:** SMS disabled by default

### Why Disabled for Bulk?
- **Cost:** ₱0.50-₱1.00 per SMS
- **Example:** 100 members = ₱50-₱100
- **Recommendation:** Use email for bulk, SMS for urgent single notifications

### To Enable SMS

1. **Sign up** at https://semaphore.co/
2. **Add to `.env`:**
   ```env
   SEMAPHORE_API_KEY=your-api-key
   SMS_SENDER_NAME=SVPMPC
   ```
3. **Modify controller** (if you want SMS for bulk):
   ```javascript
   // In server/shared/controllers/adminController.js
   notificationResults = await sendBulkCredentials(results.success, {
     email: true,
     sms: true, // Change to true
   });
   ```

---

## 🔍 Checking Results

### In Super Admin Portal

After upload, you'll see:

```
✅ Bulk upload complete!
   - Total: 20 members
   - Successful: 18 members
   - Failed: 2 members

📧 Emails sent to 18 members
```

### In Console Logs

```bash
✅ Email sent to juan.delacruz@example.com: <message-id>
✅ Email sent to maria.santos@example.com: <message-id>
❌ Error sending email to invalid@email.com: Invalid recipient
```

### In API Response

The response includes all credentials:

```json
{
  "summary": {
    "total": 20,
    "successful": 18,
    "failed": 2
  },
  "results": {
    "success": [
      {
        "memberId": "MEM-1234567890",
        "memberName": "Juan Dela Cruz",
        "email": "juan.delacruz@example.com",
        "username": "juan.delacruz1234",
        "temporaryPassword": "aB3$xY9#mK2!"
      }
    ],
    "failed": [
      {
        "email": "duplicate@email.com",
        "reason": "Email already exists"
      }
    ]
  },
  "notifications": [
    {
      "memberId": "MEM-1234567890",
      "email": "juan.delacruz@example.com",
      "notifications": {
        "email": { "success": true },
        "sms": { "success": false, "error": "SMS not configured" }
      }
    }
  ]
}
```

---

## ⚠️ Common Issues

### Issue 1: Emails Not Sending

**Symptoms:** Members not receiving emails

**Solutions:**
1. ✅ Check `.env` configuration
2. ✅ Verify Gmail app password (not regular password)
3. ✅ Check spam/junk folders
4. ✅ Look at console logs for errors
5. ✅ Test with single member first

### Issue 2: Duplicate Emails

**Symptoms:** "Email already exists" error

**Solutions:**
1. ✅ Check if member already exists in system
2. ✅ Use unique email addresses
3. ✅ Remove duplicates from CSV

### Issue 3: Invalid CSV Format

**Symptoms:** Upload fails or data missing

**Solutions:**
1. ✅ Keep header row unchanged
2. ✅ Use comma (,) as separator
3. ✅ Save as CSV format (not Excel)
4. ✅ Check for special characters in data

---

## 📊 CSV Field Details

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `memberName` | Full name | Juan Dela Cruz |
| `email` | Email address (unique) | juan.delacruz@example.com |
| `phoneNumber` | Philippine mobile | 09171234567 |
| `barangay` | Barangay name | Barangay San Jose |
| `address` | Complete address | 123 Main Street Poblacion |

### Optional Fields

| Field | Description | Example |
|-------|-------------|---------|
| `beneficiaries` | Beneficiary info | Maria Dela Cruz (Wife) |
| `dateOfBirth` | Format: YYYY-MM-DD | 1985-05-15 |
| `gender` | male or female | male |

---

## 🎯 Best Practices

### Before Upload
1. ✅ **Test with 2-3 members first**
2. ✅ **Use real email addresses** (for testing)
3. ✅ **Check for duplicates** in CSV
4. ✅ **Verify email configuration** works

### During Upload
1. ✅ **Review preview** before confirming
2. ✅ **Watch console logs** for errors
3. ✅ **Don't close browser** during upload

### After Upload
1. ✅ **Check success/failure summary**
2. ✅ **Verify emails were sent** (check logs)
3. ✅ **Save credentials** from results (backup)
4. ✅ **Test login** with a sample member

---

## 🔐 Security Notes

### Credentials
- ✅ **Random passwords** generated automatically
- ✅ **12 characters** with mixed case, numbers, symbols
- ✅ **Temporary passwords** must be changed on first login
- ✅ **Sent via secure email** with TLS encryption

### Email Security
- ✅ **Use app passwords**, not account passwords
- ✅ **Store in `.env`**, never commit to git
- ✅ **Professional templates** with security warnings
- ✅ **Direct login links** for convenience

---

## 📞 Need Help?

### Quick Checks
1. Is email configured in `.env`?
2. Is the CSV format correct?
3. Are email addresses unique?
4. Check console logs for errors

### Test Email Setup
```bash
# In server directory
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});
transporter.verify((error, success) => {
  if (error) console.log('❌ Error:', error);
  else console.log('✅ Email configured correctly!');
});
"
```

---

## 📁 Files Reference

- **Sample CSV:** `sample_members.csv`
- **Notification Service:** `server/shared/services/notificationService.js`
- **Admin Controller:** `server/shared/controllers/adminController.js`
- **Environment Config:** `server/.env`
- **Full Guide:** `MEMBER_CREDENTIALS_NOTIFICATION_GUIDE.md`

---

**Quick Summary:**
- ✅ CSV upload automatically sends emails to all members
- ✅ Each member gets username + temporary password
- ✅ SMS optional (disabled by default for bulk)
- ✅ Credentials also shown in upload results
- ✅ Sample CSV file provided with 20 examples

**Ready to upload? Just configure email and go!** 🚀
