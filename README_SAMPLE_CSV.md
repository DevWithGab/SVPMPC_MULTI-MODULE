# 📊 Sample CSV File - README

## About This File

**File:** `sample_members.csv`

This is a **sample CSV template** containing 20 realistic member records for the San Vicente Producers Multi-Purpose Cooperative (SVPMPC) system.

---

## 🎯 Purpose

Use this file to:
- ✅ **Test bulk member upload** functionality
- ✅ **Learn the correct CSV format** for member data
- ✅ **See examples** of properly formatted data
- ✅ **Create your own CSV** by editing this template

---

## 📋 File Contents

### Header Row (Required)
```csv
memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender
```

**⚠️ DO NOT CHANGE THE HEADER ROW!**

### Sample Data
- **20 members** with realistic Philippine names
- **Unique email addresses** (example.com domain)
- **Valid phone numbers** (09XX format)
- **Various barangays** across the municipality
- **Complete addresses** with street names
- **Beneficiary information** (spouse names)
- **Birth dates** in YYYY-MM-DD format
- **Gender** (male/female)

---

## 🚀 How to Use

### Option 1: Test with Sample Data

1. **Upload as-is** to test the system
2. **Change email addresses** to your test emails
3. **Check your inbox** for credentials
4. **Verify** the upload process works

### Option 2: Create Your Own CSV

1. **Open** `sample_members.csv` in Excel or text editor
2. **Keep the header row** unchanged
3. **Replace sample data** with real member data
4. **Save as CSV** format
5. **Upload** via Super Admin portal

---

## 📝 Field Descriptions

### Required Fields

| Field | Description | Format | Example |
|-------|-------------|--------|---------|
| `memberName` | Full name of member | Text | Juan Dela Cruz |
| `email` | Email address (must be unique) | email@domain.com | juan.delacruz@example.com |
| `phoneNumber` | Philippine mobile number | 09XXXXXXXXX | 09171234567 |
| `barangay` | Barangay name | Text | Barangay San Jose |
| `address` | Complete street address | Text | 123 Main Street Poblacion |

### Optional Fields

| Field | Description | Format | Example |
|-------|-------------|--------|---------|
| `beneficiaries` | Beneficiary information | Text | Maria Dela Cruz (Wife) |
| `dateOfBirth` | Date of birth | YYYY-MM-DD | 1985-05-15 |
| `gender` | Gender | male/female | male |

---

## ✅ Data Validation

### Email Addresses
- ✅ Must be unique (no duplicates)
- ✅ Must be valid email format
- ✅ Will be used for login credentials
- ✅ Will receive welcome email with password

### Phone Numbers
- ✅ Philippine format: 09XXXXXXXXX
- ✅ 11 digits starting with 09
- ✅ Will be used for SMS (if configured)
- ✅ Example: 09171234567

### Date Format
- ✅ Must be: YYYY-MM-DD
- ✅ Example: 1985-05-15 (May 15, 1985)
- ✅ Use leading zeros (05 not 5)

### Gender
- ✅ Must be: `male` or `female`
- ✅ Lowercase only
- ✅ No other values accepted

---

## 🔍 Sample Data Overview

### Members Included

1. Juan Dela Cruz - Barangay San Jose
2. Maria Santos - Barangay Santa Cruz
3. Pedro Garcia - Barangay San Miguel
4. Ana Reyes - Barangay Santo Niño
5. Carlos Mendoza - Barangay San Antonio
6. Rosa Fernandez - Barangay San Pedro
7. Miguel Torres - Barangay San Juan
8. Elena Cruz - Barangay San Pablo
9. Roberto Ramos - Barangay San Isidro
10. Linda Gonzales - Barangay San Rafael
11. Jose Villanueva - Barangay San Lorenzo
12. Carmen Bautista - Barangay San Francisco
13. Antonio Castillo - Barangay San Vicente
14. Sofia Morales - Barangay San Nicolas
15. Diego Navarro - Barangay San Roque
16. Isabella Herrera - Barangay San Martin
17. Gabriel Jimenez - Barangay San Carlos
18. Lucia Ortega - Barangay San Agustin
19. Fernando Diaz - Barangay San Mateo
20. Patricia Romero - Barangay San Andres

### Data Characteristics

- **Realistic Philippine names** (common surnames)
- **Diverse barangays** (20 different barangays)
- **Varied addresses** (streets, subdivisions, zones)
- **Age range:** 30-49 years old (born 1975-1994)
- **Gender balance:** 10 male, 10 female
- **All have beneficiaries** (spouse information)

---

## 📧 What Happens After Upload

### Automatic Process

```
1. CSV file uploaded
   ↓
2. System validates data
   ↓
3. Members created in database
   ↓
4. User accounts created
   ↓
5. Random passwords generated
   ↓
6. 📧 EMAILS SENT TO ALL MEMBERS
   ↓
7. Results shown to admin
```

### Email Content

Each member receives:
- Welcome message
- Member ID (auto-generated)
- Username (auto-generated from email)
- Temporary password (random, secure)
- Login instructions
- Direct link to portal

### Example Credentials

**For:** juan.delacruz@example.com

**Receives:**
- Member ID: `MEM-1234567890`
- Username: `juan.delacruz1234`
- Password: `aB3$xY9#mK2!`

---

## ⚠️ Important Notes

### Before Upload

1. ✅ **Configure email** in `server/.env`
2. ✅ **Test with 2-3 members** first
3. ✅ **Use real email addresses** (for testing)
4. ✅ **Check for duplicates** in your data
5. ✅ **Verify CSV format** is correct

### During Upload

1. ✅ **Review preview** (first 5 rows shown)
2. ✅ **Check for errors** in preview
3. ✅ **Confirm upload** when ready
4. ✅ **Wait for completion** (don't close browser)

### After Upload

1. ✅ **Check success/failure summary**
2. ✅ **Verify emails were sent** (check logs)
3. ✅ **Save credentials** from results
4. ✅ **Test login** with a sample member
5. ✅ **Ask members to check email** (including spam)

---

## 🛠️ Editing Tips

### Using Excel

1. Open CSV in Excel
2. Edit data in cells
3. **Save As** → CSV (Comma delimited)
4. **Important:** Choose CSV, not Excel format

### Using Text Editor

1. Open CSV in Notepad/VS Code
2. Each line = one member
3. Fields separated by commas
4. No extra spaces around commas
5. Save with UTF-8 encoding

### Common Mistakes to Avoid

❌ Changing header row
❌ Using semicolons instead of commas
❌ Adding extra columns
❌ Duplicate email addresses
❌ Invalid date formats
❌ Missing required fields
❌ Extra spaces in data

---

## 🔐 Security & Privacy

### Sample Data
- ✅ **Fictional names** - not real people
- ✅ **Example emails** - @example.com domain
- ✅ **Test phone numbers** - not real numbers
- ✅ **Safe to use** for testing

### Your Real Data
- ⚠️ **Keep CSV secure** - contains personal information
- ⚠️ **Don't share publicly** - member data is confidential
- ⚠️ **Delete after upload** - or store securely
- ⚠️ **Use HTTPS** - when uploading to production

---

## 📊 File Format Details

### CSV Structure

```
Header Row (line 1):
memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender

Data Rows (line 2+):
Juan Dela Cruz,juan.delacruz@example.com,09171234567,Barangay San Jose,123 Main Street,Maria Dela Cruz (Wife),1985-05-15,male
```

### Encoding
- **UTF-8** (supports special characters)
- **No BOM** (Byte Order Mark)
- **LF or CRLF** line endings (both work)

### Separators
- **Comma (,)** - field separator
- **No quotes** needed (unless field contains comma)
- **No spaces** around commas

---

## 🎯 Quick Start

### 1. Test Upload (5 minutes)

```bash
# 1. Configure email
cd server
cp .env.example .env
# Edit .env with your Gmail credentials

# 2. Start servers
npm run dev  # In server directory
npm run dev  # In client directory

# 3. Upload CSV
# - Login to Super Admin
# - Click "Bulk Upload"
# - Select sample_members.csv
# - Upload!
```

### 2. Create Your Own CSV

```bash
# 1. Copy sample file
cp sample_members.csv my_members.csv

# 2. Edit with your data
# - Keep header row
# - Replace sample data
# - Save as CSV

# 3. Upload
# - Same process as test upload
```

---

## 📞 Need Help?

### Common Questions

**Q: Can I add more columns?**
A: No, use only the columns in the header row.

**Q: Can I skip optional fields?**
A: Yes, leave them empty but keep the commas.

**Q: What if email already exists?**
A: That member will fail, others will succeed.

**Q: How many members can I upload?**
A: Recommended: 100-500 per batch.

**Q: Will members get their passwords?**
A: Yes! Automatically via email.

### Resources

- **Quick Guide:** `CSV_UPLOAD_QUICK_GUIDE.md`
- **Full Guide:** `MEMBER_CREDENTIALS_NOTIFICATION_GUIDE.md`
- **Summary:** `CREDENTIALS_DELIVERY_SUMMARY.md`
- **Credentials:** `CREDENTIALS_QUICK_REFERENCE.md`

---

## ✅ Checklist

Before uploading, verify:

- [ ] Header row is unchanged
- [ ] All required fields are filled
- [ ] Email addresses are unique
- [ ] Phone numbers are in 09XX format
- [ ] Dates are in YYYY-MM-DD format
- [ ] Gender is male or female
- [ ] No duplicate emails in CSV
- [ ] Email is configured in .env
- [ ] File is saved as CSV format

---

**Ready to upload? You've got this!** 🚀

**File Location:** `sample_members.csv` (project root)
**Last Updated:** 2024
