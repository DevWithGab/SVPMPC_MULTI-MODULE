# SVPMPC Multi-Module System - Login Credentials

## 🔐 Super Admin
**Access**: Full system access + Member CSV upload
- **Username**: `superadmin`
- **Password**: `SuperAdmin2024!`
- **URL**: `/super-admin`

---

## 📊 Attendance Module

### Admin
**Access**: Event management, reports, scanner stations
- **Username**: `attendance.admin`
- **Password**: `AttendanceAdmin2024!`

### Secretary
**Access**: Manual attendance, member directory, event management
- **Username**: `attendance.secretary`
- **Password**: `AttendanceSecretary2024!`

---

## 💰 Mortuary Module

### Admin
**Access**: Member management, reports, database backup, settings
- **Username**: `mortuary.admin`
- **Password**: `MortuaryAdmin2024!`

### Treasurer
**Access**: Fund management, contributions, ledger, death verifications
- **Username**: `mortuary.treasurer`
- **Password**: `MortuaryTreasurer2024!`

---

## 👥 Members
**Members are NOT seeded** - they must be uploaded via CSV in the SuperAdmin portal.

### How to Add Members:
1. Login as SuperAdmin
2. Go to "Bulk Member Upload" tab
3. Upload CSV file with member data
4. System will create Member records + User accounts automatically
5. Members can then login with their generated credentials

---

## 🔄 Password Reset
If you need to reset any password, use the appropriate script:
- **SuperAdmin**: `node server/scripts/resetSuperAdminPassword.js`
- **Treasurer**: `node server/scripts/resetTreasurerPassword.js`
- **Re-seed all**: `node server/scripts/seedUsers.js`

---

## 📝 Notes
- All staff accounts (admin, secretary, treasurer) are seeded on first run
- Regular members are only created via SuperAdmin CSV upload
- Each member gets a unique username and temporary password
- Members must change password on first login
