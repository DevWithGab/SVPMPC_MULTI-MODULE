# API Service Usage Guide

## Overview

The `client/src/services/api.js` file contains organized API endpoints for all modules in the Samahang Kooperatibo system. It uses Axios with automatic token injection for authenticated requests.

---

## Setup

### 1. Import the API Services

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

### 2. Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## API Categories

### 1. Authentication API

#### Login
```javascript
const handleLogin = async (username, password) => {
  try {
    const response = await authAPI.login(username, password);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    // Redirect to dashboard
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

#### Change Password
```javascript
const handleChangePassword = async (userId, oldPassword, newPassword) => {
  try {
    const response = await authAPI.changePassword(userId, oldPassword, newPassword);
    console.log('Password changed:', response.message);
  } catch (error) {
    console.error('Password change failed:', error);
  }
};
```

#### Get Profile
```javascript
const fetchProfile = async (userId) => {
  try {
    const profile = await authAPI.getProfile(userId);
    console.log('User profile:', profile);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
  }
};
```

#### Verify Token
```javascript
const verifyUserToken = async () => {
  try {
    const result = await authAPI.verifyToken();
    console.log('Token is valid:', result.valid);
  } catch (error) {
    console.error('Token verification failed:', error);
  }
};
```

---

### 2. Bulk Import API

#### Upload CSV
```javascript
const handleFileUpload = async (file) => {
  try {
    const response = await bulkImportAPI.uploadCSV(file);
    console.log('Preview data:', response.previewData);
    console.log('Operation ID:', response.operationId);
    return response.operationId;
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

#### Confirm Import
```javascript
const handleConfirmImport = async (operationId) => {
  try {
    const response = await bulkImportAPI.confirmImport(operationId, ['email', 'sms']);
    console.log('Import started:', response.message);
  } catch (error) {
    console.error('Import confirmation failed:', error);
  }
};
```

#### Get Import Status
```javascript
const checkImportStatus = async (operationId) => {
  try {
    const status = await bulkImportAPI.getImportStatus(operationId);
    console.log('Progress:', status.progress);
    console.log('Success count:', status.successCount);
  } catch (error) {
    console.error('Failed to fetch status:', error);
  }
};
```

#### Get All Operations
```javascript
const fetchImportHistory = async () => {
  try {
    const response = await bulkImportAPI.getAllOperations();
    console.log('Import operations:', response.operations);
  } catch (error) {
    console.error('Failed to fetch operations:', error);
  }
};
```

---

### 3. Member API

#### Get All Members
```javascript
const fetchAllMembers = async () => {
  try {
    const response = await memberAPI.getAllMembers();
    console.log('Members:', response.members);
  } catch (error) {
    console.error('Failed to fetch members:', error);
  }
};
```

#### Get Member by ID
```javascript
const fetchMember = async (memberId) => {
  try {
    const member = await memberAPI.getMemberById(memberId);
    console.log('Member:', member);
  } catch (error) {
    console.error('Failed to fetch member:', error);
  }
};
```

#### Generate QR Codes
```javascript
const generateQRs = async (memberIds) => {
  try {
    const response = await memberAPI.generateQRCodes(memberIds);
    console.log('QR codes generated:', response.count);
  } catch (error) {
    console.error('Failed to generate QR codes:', error);
  }
};
```

---

### 4. Event API

#### Create Event
```javascript
const handleCreateEvent = async (eventData) => {
  try {
    const response = await eventAPI.createEvent({
      eventName: 'Monthly Meeting',
      eventDate: '2024-02-01',
      eventTime: '14:00',
      location: 'Community Center',
      description: 'Monthly cooperative meeting',
    });
    console.log('Event created:', response);
  } catch (error) {
    console.error('Failed to create event:', error);
  }
};
```

#### Get All Events
```javascript
const fetchEvents = async () => {
  try {
    const response = await eventAPI.getAllEvents();
    console.log('Events:', response.events);
  } catch (error) {
    console.error('Failed to fetch events:', error);
  }
};
```

#### Update Event
```javascript
const handleUpdateEvent = async (eventId, eventData) => {
  try {
    const response = await eventAPI.updateEvent(eventId, eventData);
    console.log('Event updated:', response);
  } catch (error) {
    console.error('Failed to update event:', error);
  }
};
```

#### Delete Event
```javascript
const handleDeleteEvent = async (eventId) => {
  try {
    const response = await eventAPI.deleteEvent(eventId);
    console.log('Event deleted:', response.message);
  } catch (error) {
    console.error('Failed to delete event:', error);
  }
};
```

---

### 5. Scanner API

#### Register Scanner
```javascript
const registerScanner = async () => {
  try {
    const response = await scannerAPI.registerScanner({
      stationName: 'Scanner Station 1',
      location: 'Event Venue',
      deviceId: 'DEVICE-001',
      ipAddress: '192.168.1.100',
      userAgent: navigator.userAgent,
    });
    console.log('Scanner registered:', response.station.stationId);
  } catch (error) {
    console.error('Failed to register scanner:', error);
  }
};
```

#### Process QR Scan
```javascript
const handleQRScan = async (stationId, qrCodeData, eventId) => {
  try {
    const response = await scannerAPI.processScan(stationId, qrCodeData, eventId);
    console.log('Attendance recorded:', response.data.memberName);
  } catch (error) {
    if (error.response?.data?.status === 'duplicate') {
      console.log('Already marked present');
    } else {
      console.error('Scan failed:', error);
    }
  }
};
```

#### Send Heartbeat
```javascript
const sendHeartbeat = async (stationId) => {
  try {
    await scannerAPI.sendHeartbeat(stationId);
    console.log('Heartbeat sent');
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
};
```

---

### 6. Member Portal API

#### Get Member Profile
```javascript
const fetchMemberProfile = async (memberId) => {
  try {
    const profile = await memberPortalAPI.getMemberProfile(memberId);
    console.log('Profile:', profile);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
  }
};
```

#### Get Attendance History
```javascript
const fetchAttendanceHistory = async (memberId) => {
  try {
    const response = await memberPortalAPI.getAttendanceHistory(memberId);
    console.log('Attendance history:', response.attendanceHistory);
  } catch (error) {
    console.error('Failed to fetch attendance history:', error);
  }
};
```

---

### 7. Attendance API

#### Record Attendance
```javascript
const recordAttendance = async (memberId, eventId) => {
  try {
    const response = await attendanceAPI.recordAttendance(
      memberId,
      eventId,
      new Date().toISOString()
    );
    console.log('Attendance recorded:', response);
  } catch (error) {
    console.error('Failed to record attendance:', error);
  }
};
```

#### Get Attendance Stats
```javascript
const fetchAttendanceStats = async (eventId) => {
  try {
    const stats = await attendanceAPI.getAttendanceStats(eventId);
    console.log('Attendance rate:', stats.attendanceRate);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
};
```

---

### 8. Mortuary Dashboard API

#### Get Dashboard
```javascript
const fetchMortuaryDashboard = async (memberId) => {
  try {
    const dashboard = await mortuaryDashboardAPI.getDashboard(memberId);
    console.log('Current balance:', dashboard.currentBalance);
    console.log('Next payment due:', dashboard.nextPaymentDue);
  } catch (error) {
    console.error('Failed to fetch dashboard:', error);
  }
};
```

---

### 9. Claims API

#### File New Claim
```javascript
const handleFileClaim = async (claimData) => {
  try {
    const response = await claimAPI.fileNewClaim({
      memberId: 'M001',
      deceasedName: 'Maria Dela Cruz',
      relationshipToDeceased: 'spouse',
      dateOfDeath: '2024-01-01',
      claimAmount: 10000,
      reason: 'Death benefit claim',
    });
    console.log('Claim filed:', response.claimId);
  } catch (error) {
    console.error('Failed to file claim:', error);
  }
};
```

#### Get Claim History
```javascript
const fetchClaimHistory = async (memberId) => {
  try {
    const response = await claimAPI.getClaimHistory(memberId);
    console.log('Claims:', response.claims);
  } catch (error) {
    console.error('Failed to fetch claims:', error);
  }
};
```

#### Approve Claim
```javascript
const handleApproveClaim = async (claimId) => {
  try {
    const response = await claimAPI.approveClaim(claimId, {
      approvedBy: 'admin_id',
      approvalNotes: 'Claim approved',
    });
    console.log('Claim approved:', response);
  } catch (error) {
    console.error('Failed to approve claim:', error);
  }
};
```

---

### 10. Contributions API

#### Record Contribution
```javascript
const handleRecordContribution = async (memberId, amount) => {
  try {
    const response = await contributionAPI.recordContribution({
      memberId,
      amount,
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString(),
      reference: 'PAY001',
    });
    console.log('Contribution recorded:', response);
  } catch (error) {
    console.error('Failed to record contribution:', error);
  }
};
```

#### Get Contribution History
```javascript
const fetchContributionHistory = async (memberId) => {
  try {
    const response = await contributionAPI.getContributionHistory(memberId);
    console.log('Contributions:', response.contributions);
  } catch (error) {
    console.error('Failed to fetch contributions:', error);
  }
};
```

---

### 11. Ledger API

#### Get Member Ledger
```javascript
const fetchMemberLedger = async (memberId) => {
  try {
    const response = await ledgerAPI.getMemberLedger(memberId);
    console.log('Ledger entries:', response.ledgerEntries);
  } catch (error) {
    console.error('Failed to fetch ledger:', error);
  }
};
```

#### Get Member Balance
```javascript
const fetchMemberBalance = async (memberId) => {
  try {
    const balance = await ledgerAPI.getMemberBalance(memberId);
    console.log('Current balance:', balance.currentBalance);
  } catch (error) {
    console.error('Failed to fetch balance:', error);
  }
};
```

---

### 12. Payment Schedule API

#### Create Payment Schedule
```javascript
const handleCreateSchedule = async (memberId) => {
  try {
    const response = await paymentScheduleAPI.createPaymentSchedule({
      memberId,
      monthlyAmount: 500,
      dueDate: 1,
      startDate: new Date().toISOString(),
    });
    console.log('Schedule created:', response);
  } catch (error) {
    console.error('Failed to create schedule:', error);
  }
};
```

#### Get Payment Schedule
```javascript
const fetchPaymentSchedule = async (memberId) => {
  try {
    const schedule = await paymentScheduleAPI.getPaymentSchedule(memberId);
    console.log('Next due date:', schedule.nextDueDate);
  } catch (error) {
    console.error('Failed to fetch schedule:', error);
  }
};
```

#### Get Overdue Payments
```javascript
const fetchOverduePayments = async () => {
  try {
    const response = await paymentScheduleAPI.getOverduePayments();
    console.log('Overdue payments:', response.overduePayments);
  } catch (error) {
    console.error('Failed to fetch overdue payments:', error);
  }
};
```

---

### 13. Notifications API

#### Send Reminder to Member
```javascript
const handleSendReminder = async (memberId) => {
  try {
    const response = await notificationAPI.sendReminderToMember(memberId, {
      reminderType: 'email',
      message: 'Your payment is due on 2024-02-01',
    });
    console.log('Reminder sent:', response);
  } catch (error) {
    console.error('Failed to send reminder:', error);
  }
};
```

#### Send Bulk Reminders
```javascript
const handleSendBulkReminders = async () => {
  try {
    const response = await notificationAPI.sendBulkRemindersToOverdue({
      reminderType: 'email',
      daysOverdue: 7,
    });
    console.log('Reminders sent:', response.sentCount);
  } catch (error) {
    console.error('Failed to send bulk reminders:', error);
  }
};
```

---

## Error Handling

### Global Error Handler

```javascript
import api from '../services/api';

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Component Error Handling

```javascript
const handleAction = async () => {
  try {
    const response = await someAPI.someMethod();
    // Handle success
  } catch (error) {
    if (error.response?.status === 400) {
      console.error('Bad request:', error.response.data.message);
    } else if (error.response?.status === 401) {
      console.error('Unauthorized');
    } else if (error.response?.status === 404) {
      console.error('Not found');
    } else if (error.response?.status === 500) {
      console.error('Server error');
    } else {
      console.error('Error:', error.message);
    }
  }
};
```

---

## Best Practices

### 1. Use Try-Catch
```javascript
try {
  const data = await authAPI.login(username, password);
  // Handle success
} catch (error) {
  // Handle error
}
```

### 2. Store Token
```javascript
const response = await authAPI.login(username, password);
localStorage.setItem('token', response.token);
```

### 3. Use Loading States
```javascript
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await someAPI.someMethod();
  } finally {
    setLoading(false);
  }
};
```

### 4. Validate Input
```javascript
const handleLogin = async (username, password) => {
  if (!username || !password) {
    console.error('Username and password are required');
    return;
  }
  // Proceed with login
};
```

### 5. Use Async/Await
```javascript
const fetchData = async () => {
  try {
    const data = await memberAPI.getAllMembers();
    setMembers(data.members);
  } catch (error) {
    console.error('Failed to fetch members:', error);
  }
};
```

---

## Summary

The API service file provides:
- ✅ Organized API endpoints by module
- ✅ Automatic token injection
- ✅ Error handling
- ✅ Easy to use and maintain
- ✅ Type-safe with proper documentation
- ✅ Ready for production use

---

**Last Updated:** April 18, 2026
