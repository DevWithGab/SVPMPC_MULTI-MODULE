# Database Seeding Guide

## Overview
This guide explains how to seed the database with initial admin accounts, staff members, and sample data for the SVPMPC Multi-Module System.

## Prerequisites
- MongoDB running locally or connection string configured
- Node.js installed
- Server dependencies installed (`npm install` in server directory)

## How to Seed the Database

### Step 1: Navigate to Server Directory
```bash
cd server
```

### Step 2: Run the Seed Script
```bash
npm run seed
```

### Step 3: Wait for Completion
The script will:
1. Connect to MongoDB
2. Create staff member records
3. Create admin user accounts
4. Create sample member accounts
5. Display credentials summary

## Seeded Accounts

### 🔐 Super Admin
**Purpose:** Full system access + member management

| Field | Value |
|-------|-------|
| Username | `superadmin` |
| Password | `SuperAdmin2024!` |
| Email | superadmin@svpmpc.com |
| Phone | 09171111111 |
| Access | All modules + Super Admin portal |
| Role | super_admin |

**Login:** Use these credentials to access the Super Admin portal at `/super-admin`

---

### 📊 Attendance Module Staff

#### Admin
**Purpose:** Manage attendance system, events, members, reports

| Field | Value |
|-------|-------|
| Username | `attendance.admin` |
| Password | `AttendanceAdmin2024!` |
| Email | attendance.admin@svpmpc.com |
| Phone | 09172222222 |
| Access | Attendance module only |
| Role | admin |

**Login:** Select "Attendance System" → "Administrator" → Use credentials

#### Secretary
**Purpose:** Record attendance, manage events, view reports

| Field | Value |
|-------|-------|
| Username | `attendance.secretary` |
| Password | `AttendanceSecretary2024!` |
| Email | attendance.secretary@svpmpc.com |
| Phone | 09173333333 |
| Access | Attendance module only |
| Role | secretary |

**Login:** Select "Attendance System" → "Secretary" → Use credentials

---

### 💰 Mortuary Module Staff

#### Admin
**Purpose:** Manage mortuary fund, members, claims, payouts

| Field | Value |
|-------|-------|
| Username | `mortuary.admin` |
| Password | `MortuaryAdmin2024!` |
| Email | mortuary.admin@svpmpc.com |
| Phone | 09174444444 |
| Access | Mortuary module only |
| Role | admin |

**Login:** Select "Mortuary Fund" → "Administrator" → Use credentials

#### Treasurer
**Purpose:** Manage contributions, process claims, handle finances

| Field | Value |
|-------|-------|
| Username | `mortuary.treasurer` |
| Password | `MortuaryTreasurer2024!` |
| Email | mortuary.treasurer@svpmpc.com |
| Phone | 09175555555 |
| Access | Mortuary module only |
| Role | treasurer |

**Login:** Select "Mortuary Fund" → "Treasurer/Staff" → Use credentials

---

### 👥 Sample Members
**Purpose:** Test member accounts with access to both modules

All sample members have:
- Password: `Member2024!`
- Access: Both Attendance and Mortuary modules
- Status: Active
- Temporary Password: Yes (must change on first login)

#### Member 1: Juan Dela Cruz
| Field | Value |
|-------|-------|
| Username | `juan.delacruz` |
| Email | juan.delacruz@example.com |
| Phone | 09176666666 |
| Member ID | MEM-2024-001 |
| Barangay | Barangay 1 |
| Address | 123 Main Street, City |
| Beneficiaries | Maria Dela Cruz (Wife) |

#### Member 2: Maria Santos
| Field | Value |
|-------|-------|
| Username | `maria.santos` |
| Email | maria.santos@example.com |
| Phone | 09177777777 |
| Member ID | MEM-2024-002 |
| Barangay | Barangay 2 |
| Address | 456 Oak Avenue, City |
| Beneficiaries | Pedro Santos (Husband) |

#### Member 3: Pedro Garcia
| Field | Value |
|-------|-------|
| Username | `pedro.garcia` |
| Email | pedro.garcia@example.com |
| Phone | 09178888888 |
| Member ID | MEM-2024-003 |
| Barangay | Barangay 3 |
| Address | 789 Pine Road, City |
| Beneficiaries | Ana Garcia (Wife) |

---

## Testing the Seeded Accounts

### Test Super Admin
1. Go to login page
2. Click "Super Admin Access" in footer
3. Enter password: `SuperAdmin2024!`
4. Access member management dashboard

### Test Attendance Admin
1. Select "Attendance System"
2. Select "Administrator"
3. Username: `attendance.admin`
4. Password: `AttendanceAdmin2024!`
5. Access attendance admin portal

### Test Attendance Secretary
1. Select "Attendance System"
2. Select "Secretary"
3. Username: `attendance.secretary`
4. Password: `AttendanceSecretary2024!`
5. Access secretary portal

### Test Mortuary Admin
1. Select "Mortuary Fund"
2. Select "Administrator"
3. Username: `mortuary.admin`
4. Password: `MortuaryAdmin2024!`
5. Access mortuary admin portal

### Test Mortuary Treasurer
1. Select "Mortuary Fund"
2. Select "Treasurer/Staff"
3. Username: `mortuary.treasurer`
4. Password: `MortuaryTreasurer2024!`
5. Access treasurer portal

### Test Sample Member
1. Select any module (Attendance or Mortuary)
2. Select "Member"
3. Username: `juan.delacruz` (or any sample member)
4. Password: `Member2024!`
5. System will prompt to change password
6. Access member portal

---

## Re-seeding the Database

### Option 1: Run Seed Script Again
The script checks for existing records and skips them:
```bash
npm run seed
```

### Option 2: Clear and Re-seed
If you want to start fresh:

1. **Clear the database:**
```javascript
// In MongoDB shell or Compass
use svpmpc-multi-module
db.users.deleteMany({})
db.members.deleteMany({})
```

2. **Run seed script:**
```bash
npm run seed
```

---

## Customizing Seed Data

### Change Passwords
Edit `server/scripts/seedUsers.js`:

```javascript
const seedData = {
  superAdmin: {
    // ...
    passwordHash: 'YourNewPassword123!',
  },
  // ... other accounts
};
```

### Add More Staff
Add to the `seedData` object:

```javascript
attendanceStaff: {
  userId: 'ATT-STAFF-001',
  memberId: 'ATT-STAFF-MEM',
  username: 'attendance.staff',
  email: 'staff@svpmpc.com',
  phoneNumber: '09179999999',
  passwordHash: 'StaffPassword2024!',
  isTemporaryPassword: false,
  status: 'active',
  modules: ['attendance'],
  role: 'staff',
},
```

### Add More Sample Members
Add to `sampleMembers` array:

```javascript
{
  memberId: 'MEM-2024-004',
  memberName: 'Ana Reyes',
  email: 'ana.reyes@example.com',
  phoneNumber: '09179999999',
  barangay: 'Barangay 4',
  address: '321 Elm Street, City',
  beneficiaries: 'Carlos Reyes (Husband)',
  status: 'active',
  modules: ['attendance', 'mortuary'],
  userId: 'USER-MEM-004',
  username: 'ana.reyes',
  password: 'Member2024!',
},
```

---

## Troubleshooting

### Issue: "MongoDB connection error"
**Solution:** 
- Check if MongoDB is running
- Verify connection string in `.env` file
- Ensure `MONGODB_URI` is set correctly

### Issue: "User already exists"
**Solution:** 
- This is normal if re-running the script
- Script skips existing records
- To start fresh, clear the database first

### Issue: "Cannot find module"
**Solution:**
- Run `npm install` in server directory
- Ensure all dependencies are installed

### Issue: "Password not working"
**Solution:**
- Check for typos (passwords are case-sensitive)
- Ensure you're using the correct username
- Try re-seeding the database

---

## Security Best Practices

### Production Deployment

1. **Change All Passwords**
   - Never use default passwords in production
   - Use strong, unique passwords for each account

2. **Use Environment Variables**
   ```javascript
   passwordHash: process.env.SUPER_ADMIN_PASSWORD || 'DefaultPassword',
   ```

3. **Disable Seed Script**
   - Remove or comment out seed script in production
   - Only run once during initial setup

4. **Enable Password Expiry**
   - Force password changes after first login
   - Implement password rotation policy

5. **Audit Logging**
   - Log all admin actions
   - Monitor super admin access
   - Track member creation/modifications

---

## Database Schema

### Users Collection
```javascript
{
  userId: String (unique),
  memberId: String (unique, ref: Member),
  username: String (unique),
  email: String,
  phoneNumber: String,
  passwordHash: String (bcrypt hashed),
  isTemporaryPassword: Boolean,
  lastPasswordChangeDate: Date,
  lastLoginDate: Date,
  status: String (active/inactive/suspended),
  modules: [String] (attendance/mortuary),
  role: String (member/admin/secretary/treasurer/super_admin),
  createdAt: Date,
  updatedAt: Date
}
```

### Members Collection
```javascript
{
  memberId: String (unique),
  memberName: String,
  email: String,
  phoneNumber: String,
  barangay: String,
  address: String,
  beneficiaries: String,
  dateOfBirth: Date,
  gender: String,
  status: String (active/inactive/deceased),
  modules: [String],
  qrCode: String (for attendance),
  qrCodeUrl: String,
  qrCodeGenerated: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Quick Reference

### Run Seed Script
```bash
cd server
npm run seed
```

### View Seeded Data
```bash
# MongoDB Shell
mongosh
use svpmpc-multi-module
db.users.find().pretty()
db.members.find().pretty()
```

### Count Records
```bash
db.users.countDocuments()
db.members.countDocuments()
```

### Find Specific User
```bash
db.users.findOne({ username: "superadmin" })
```

---

## Support

For issues or questions:
1. Check this guide first
2. Review error messages in console
3. Verify MongoDB connection
4. Check server logs
5. Contact system administrator

---

**Last Updated:** 2024
**Version:** 1.0.0
