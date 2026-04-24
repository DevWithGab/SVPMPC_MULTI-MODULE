# API Quick Reference Card

## Import All APIs

```javascript
import {
  authAPI,
  bulkImportAPI,
  memberAPI,
  eventAPI,
  scannerAPI,
  memberPortalAPI,
  attendanceAPI,
  mortuaryDashboardAPI,
  claimAPI,
  contributionAPI,
  ledgerAPI,
  paymentScheduleAPI,
  notificationAPI,
} from '../services/api';
```

---

## Authentication

```javascript
// Login
await authAPI.login(username, password);

// Change Password
await authAPI.changePassword(userId, oldPassword, newPassword);

// Get Profile
await authAPI.getProfile(userId);

// Get Credential History
await authAPI.getCredentialHistory(userId);

// Verify Token
await authAPI.verifyToken();
```

---

## Bulk Import

```javascript
// Upload CSV
await bulkImportAPI.uploadCSV(file);

// Confirm Import
await bulkImportAPI.confirmImport(operationId, ['email', 'sms']);

// Get Import Status
await bulkImportAPI.getImportStatus(operationId);

// Get Import Details
await bulkImportAPI.getImportDetails(operationId);

// Get All Operations
await bulkImportAPI.getAllOperations();
```

---

## Members

```javascript
// Get All Members
await memberAPI.getAllMembers();

// Get Member by ID
await memberAPI.getMemberById(memberId);

// Upload Members
await memberAPI.uploadMembers(file);

// Generate QR Codes
await memberAPI.generateQRCodes(memberIds);

// Generate All QR Codes
await memberAPI.generateAllQRCodes();
```

---

## Events

```javascript
// Create Event
await eventAPI.createEvent(eventData);

// Get All Events
await eventAPI.getAllEvents();

// Get Event by ID
await eventAPI.getEventById(eventId);

// Update Event
await eventAPI.updateEvent(eventId, eventData);

// Delete Event
await eventAPI.deleteEvent(eventId);
```

---

## Scanner

```javascript
// Register Scanner
await scannerAPI.registerScanner(scannerData);

// Send Heartbeat
await scannerAPI.sendHeartbeat(stationId);

// Process Scan
await scannerAPI.processScan(stationId, qrCodeData, eventId);

// Get All Scanners
await scannerAPI.getAllScanners();

// Get Scanner by ID
await scannerAPI.getScannerById(stationId);

// Get Scan Logs
await scannerAPI.getScanLogs(stationId);

// Update Scanner Status
await scannerAPI.updateScannerStatus(stationId, status);
```

---

## Member Portal

```javascript
// Get Member Profile
await memberPortalAPI.getMemberProfile(memberId);

// Get Attendance History
await memberPortalAPI.getAttendanceHistory(memberId);
```

---

## Attendance

```javascript
// Record Attendance
await attendanceAPI.recordAttendance(memberId, eventId, scanTime);

// Get Attendance by Event
await attendanceAPI.getAttendanceByEvent(eventId);

// Get Attendance Stats
await attendanceAPI.getAttendanceStats(eventId);

// Generate Report
await attendanceAPI.generateReport(eventId, format);

// Get All Attendance
await attendanceAPI.getAllAttendance();
```

---

## Mortuary Dashboard

```javascript
// Get Dashboard
await mortuaryDashboardAPI.getDashboard(memberId);
```

---

## Claims

```javascript
// File New Claim
await claimAPI.fileNewClaim(claimData);

// Get Claim History
await claimAPI.getClaimHistory(memberId);

// Get Claim by ID
await claimAPI.getClaimById(claimId);

// Approve Claim
await claimAPI.approveClaim(claimId, approvalData);

// Reject Claim
await claimAPI.rejectClaim(claimId, rejectionData);

// Pay Claim
await claimAPI.payClaim(claimId, paymentData);
```

---

## Contributions

```javascript
// Record Contribution
await contributionAPI.recordContribution(contributionData);

// Get Contribution History
await contributionAPI.getContributionHistory(memberId);

// Get All Contributions
await contributionAPI.getAllContributions();
```

---

## Ledger

```javascript
// Get Member Ledger
await ledgerAPI.getMemberLedger(memberId);

// Get All Ledger
await ledgerAPI.getAllLedger();

// Get Member Balance
await ledgerAPI.getMemberBalance(memberId);
```

---

## Payment Schedule

```javascript
// Create Payment Schedule
await paymentScheduleAPI.createPaymentSchedule(scheduleData);

// Get Payment Schedule
await paymentScheduleAPI.getPaymentSchedule(memberId);

// Get All Payment Schedules
await paymentScheduleAPI.getAllPaymentSchedules();

// Get Overdue Payments
await paymentScheduleAPI.getOverduePayments();

// Update Next Due Date
await paymentScheduleAPI.updateNextDueDate(scheduleId, nextDueDate);

// Mark Reminder Sent
await paymentScheduleAPI.markReminderSent(scheduleId, reminderData);
```

---

## Notifications

```javascript
// Send Reminder to Member
await notificationAPI.sendReminderToMember(memberId, reminderData);

// Send Bulk Reminders to Overdue
await notificationAPI.sendBulkRemindersToOverdue(reminderData);

// Send Reminders to Members
await notificationAPI.sendRemindersToMembers(memberIds, reminderData);

// Get Reminder History
await notificationAPI.getReminderHistory(memberId);
```

---

## Common Usage Pattern

```javascript
import { authAPI, memberAPI } from '../services/api';
import { useState } from 'react';

export default function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memberAPI.getAllMembers();
      console.log('Members:', data.members);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleAction} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Members'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

---

## Error Handling

```javascript
try {
  const response = await authAPI.login(username, password);
  // Success
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Invalid credentials');
  } else if (error.response?.status === 404) {
    console.error('User not found');
  } else if (error.response?.status === 500) {
    console.error('Server error');
  } else {
    console.error('Error:', error.message);
  }
}
```

---

## Environment Setup

### .env file
```
VITE_API_BASE_URL=http://localhost:5000/api
```

### Token Management
```javascript
// Store token after login
localStorage.setItem('token', response.token);

// Token is automatically added to all requests
// Remove token on logout
localStorage.removeItem('token');
```

---

## Total API Methods: 60+

- Authentication: 5 methods
- Bulk Import: 5 methods
- Members: 5 methods
- Events: 5 methods
- Scanner: 7 methods
- Member Portal: 2 methods
- Attendance: 5 methods
- Mortuary Dashboard: 1 method
- Claims: 6 methods
- Contributions: 3 methods
- Ledger: 3 methods
- Payment Schedule: 6 methods
- Notifications: 4 methods

---

**Ready to use!** Copy and paste the import statement and start using the APIs in your components.
