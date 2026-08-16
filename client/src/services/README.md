# API Services Documentation

Simple organized API services for the Saint Vincent Mortuary and Attendance System.

## 📁 Structure

```
services/
├── index.js                    # Main exports
├── api.js                      # Original API (still works)
├── auth.js                     # Authentication services
├── mortuary/
│   ├── index.js               # Mortuary exports
│   ├── member.js              # Member APIs
│   ├── treasurer.js           # Treasurer APIs
│   └── admin.js               # Admin APIs
└── attendance/
    ├── index.js               # Attendance exports
    ├── secretary.js           # Secretary APIs
    └── admin.js               # Admin APIs
```

> Note: attendance no longer has a member-facing API — members are handled
> via physically-issued QR codes rather than self-service portal access.

## 🚀 Usage

### Simple way (recommended):

```javascript
import { mortuaryAPI, attendanceAPI, authAPI } from '@/services';

// Login
const loginResult = await authAPI.login(username, password);

// Mortuary member
const memberData = await mortuaryAPI.member.dashboard.getDashboardData();
const contributions = await mortuaryAPI.member.contributions.getContributions();

// Mortuary treasurer
const claims = await mortuaryAPI.treasurer.claims.getClaims();
const smsResult = await mortuaryAPI.treasurer.notifications.sendSMSNotification(data);

// Attendance secretary
const events = await attendanceAPI.secretary.events.getEvents();
const attendance = await attendanceAPI.secretary.attendance.markAttendance(data);
```

### Individual imports:

```javascript
import { mortuaryMemberAPI, attendanceSecretaryAPI } from '@/services';

const dashboardData = await mortuaryMemberAPI.dashboard.getDashboardData();
const eventData = await attendanceSecretaryAPI.events.createEvent(eventData);
```

## 📋 What's Available

### Authentication
- `authAPI.login(username, password)`
- `authAPI.getProfile(userId)`
- `authAPI.changePassword(userId, oldPassword, newPassword)`
- `authAPI.logout()`

### Mortuary APIs

**Member** (`mortuaryAPI.member`)
- Dashboard: `getDashboardData()`, `getProfile()`
- Contributions: `getContributions()`, `getContributionDetails(id)`
- Claims: `getClaims()`, `submitClaim(data)`, `getClaimDetails(id)`

**Treasurer** (`mortuaryAPI.treasurer`)
- Dashboard: `getDashboardData()`, `getFundBalance()`
- Contributions: `getContributions()`, `recordContribution(data)`
- Claims: `getClaims()`, `processClaim(id, data)`
- Notifications: `sendSMSNotification(data)`, `sendContributionReminder(message)`
- Reports: `generateFinancialSummary()`, `generateContributionReport()`

**Admin** (`mortuaryAPI.admin`)
- Dashboard: `getDashboardData()`, `getFundOverview()`
- Members: `getMembers()`, `createMember(data)`, `updateMember(id, data)`
- Claims: `getClaims()`, `processClaim(id, data)`, `overrideClaim(id, data)`
- Fund: `getFundBalance()`, `adjustFundBalance(data)`
- Reports: `generateFinancialReport()`, `exportSystemData()`

### Attendance APIs

**Secretary** (`attendanceAPI.secretary`)
- Dashboard: `getDashboardData()`, `getEventStats()`
- Events: `getEvents()`, `createEvent(data)`, `updateEvent(id, data)`
- Attendance: `getAttendanceRecords()`, `markAttendance(data)`
- Members: `getMembers()`, `getMemberDetails(id)`
- Reports: `generateAttendanceReport()`, `exportAttendanceData()`

**Admin** (`attendanceAPI.admin`)
- Dashboard: `getDashboardData()`, `getSystemStats()`
- Events: `getEvents()`, `createEvent(data)`, `bulkDeleteEvents(ids)`
- Members: `getMembers()`, `createMember(data)`, `bulkImportMembers(file)`
- Scanners: `getScannerStations()`, `createScannerStation(data)`
- Reports: `generateComprehensiveReport()`, `exportSystemData()`

## 🔄 Response Format

All APIs return:

```javascript
// Success
{
  success: true,
  data: { /* your data */ },
  message?: "Success message"
}

// Error
{
  success: false,
  message: "Error description",
  error?: { /* error details */ }
}
```

## 🔧 Error Handling

```javascript
const result = await mortuaryAPI.member.dashboard.getDashboardData();

if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.message);
}
```

## 📝 Migration from old API

**Before:**
```javascript
import { claimAPI } from '@/services/api';
const claims = await claimAPI.getClaimHistory(memberId);
```

**After:**
```javascript
import { mortuaryAPI } from '@/services';
const result = await mortuaryAPI.member.claims.getClaims();
if (result.success) {
  const claims = result.data;
}
```