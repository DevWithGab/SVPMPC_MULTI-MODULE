# Database Schema - Entity Relationship Diagram (ERD) Documentation

## Database: MongoDB (Mongoose ODM)

---

## 📊 SHARED/CORE COLLECTIONS

### 1. **User** Collection
**Purpose:** Authentication and user account management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| userId | String | Unique, Required | Primary identifier |
| memberId | String | Unique, Required, FK → Member | Links to Member collection |
| username | String | Unique, Required | Login username |
| email | String | Required | User email |
| phoneNumber | String | Required | Contact number |
| passwordHash | String | Required | Hashed password |
| isTemporaryPassword | Boolean | Default: true | Password change required flag |
| lastPasswordChangeDate | Date | Nullable | Last password update |
| lastLoginDate | Date | Nullable | Last login timestamp |
| status | String | Enum: active, inactive, suspended | Account status |
| modules | [String] | Default: [attendance, mortuary] | Accessible modules |
| role | String | Enum: member, admin, secretary, treasurer, super_admin | User role |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `memberId` → **Member.memberId** (One-to-One)

---

### 2. **Member** Collection
**Purpose:** Core member information shared across all modules

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| memberId | String | Unique, Required | Primary identifier (e.g., M001) |
| memberName | String | Required | Full name |
| email | String | Required, Indexed | Email address |
| phoneNumber | String | Required | Contact number |
| barangay | String | Required | Barangay/district |
| address | String | Required | Full address |
| qrCode | String | Unique, Sparse | QR code data (Attendance) |
| qrCodeUrl | String | Optional | QR code image URL |
| qrCodeGenerated | Boolean | Default: false | QR generation status |
| beneficiaries | String | Optional | Beneficiary info (Mortuary) |
| joinDate | Date | Default: now | Membership start date |
| status | String | Enum: active, inactive, deceased, staff | Member status |
| dateOfBirth | Date | Optional | Birth date |
| gender | String | Enum: male, female, other | Gender |
| emergencyContact | Object | Optional | Emergency contact details |
| emergencyContact.name | String | Optional | Contact name |
| emergencyContact.relationship | String | Optional | Relationship |
| emergencyContact.phoneNumber | String | Optional | Contact phone |
| modules | [String] | Default: [attendance, mortuary] | Module access |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- Referenced by: **User**, **Contribution**, **Ledger**, **PaymentSchedule**, **Attendance**, **ScanLog**

---

### 3. **ImportOperation** Collection
**Purpose:** Track bulk member import operations

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| operationId | String | Unique, Required | Primary identifier |
| fileName | String | Required | Uploaded CSV filename |
| status | String | Enum: preview, processing, completed, failed | Operation status |
| totalRows | Number | Default: 0 | Total rows in CSV |
| successCount | Number | Default: 0 | Successfully imported |
| failureCount | Number | Default: 0 | Failed imports |
| duplicateCount | Number | Default: 0 | Duplicate entries |
| emailsSent | Number | Default: 0 | Emails sent count |
| emailsFailed | Number | Default: 0 | Email failures |
| smsSent | Number | Default: 0 | SMS sent count |
| smsFailed | Number | Default: 0 | SMS failures |
| previewData | [Object] | Optional | Preview of import data |
| rowErrors | [Object] | Optional | Row-level errors |
| createdUsers | [Object] | Optional | Created user accounts |
| createdBy | String | Required | Admin who initiated |
| startedAt | Date | Nullable | Operation start time |
| completedAt | Date | Nullable | Operation end time |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- Referenced by: **CredentialLog**

---

### 4. **CredentialLog** Collection
**Purpose:** Track credential generation and distribution

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| logId | String | Unique, Required | Primary identifier |
| userId | String | Required, FK → User | User account reference |
| memberId | String | Required | Member identifier |
| action | String | Enum: generated, resent, password_changed, password_reset | Action type |
| sentMethod | [String] | Enum: email, sms | Delivery methods |
| sentDate | Date | Default: now | Sent timestamp |
| status | String | Enum: success, failed, partial | Delivery status |
| failureReason | String | Nullable | Error message |
| operationId | String | FK → ImportOperation | Related import operation |
| attemptNumber | Number | Default: 1 | Retry attempt count |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `userId` → **User.userId**
- `operationId` → **ImportOperation.operationId**

---

## 💰 MORTUARY MODULE COLLECTIONS

### 5. **Contribution** Collection
**Purpose:** Track member contributions/payments

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| contributionId | String | Unique, Required | Primary identifier (e.g., CONTRIB-xxx) |
| memberId | String | Required, FK → Member | Member reference |
| amount | Number | Required | Payment amount (₱) |
| paymentDate | Date | Default: now | Payment date |
| dueDate | Date | Required | Due date |
| status | String | Enum: paid, pending, overdue | Payment status |
| paymentMethod | String | Enum: cash | Payment method (cash only) |
| referenceNumber | String | Optional | Transaction reference |
| notes | String | Optional | Additional notes |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `memberId` → **Member.memberId**

---

### 6. **Ledger** Collection
**Purpose:** Complete transaction history and balance tracking

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| ledgerId | String | Unique, Required | Primary identifier (UUID) |
| memberId | String | Required, FK → Member | Member reference |
| transactionType | String | Enum: contribution, payout, adjustment, penalty, automatic_deduction | Transaction type |
| description | String | Required | Transaction description |
| credit | Number | Default: 0 | Amount added (₱) |
| debit | Number | Default: 0 | Amount deducted (₱) |
| balance | Number | Required | Running balance (₱) |
| referenceId | String | Optional | Reference to source transaction |
| transactionDate | Date | Default: now | Transaction date |
| recordedBy | String | Optional | User who recorded |
| beneficiary | String | Optional | Payout beneficiary name |
| paymentMethod | String | Enum: cash | Payment method |
| createdAt | Date | Auto | Record creation timestamp (IMPORTANT for sorting) |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `memberId` → **Member.memberId**

**Important Notes:**
- Use `createdAt` for sorting to ensure correct chronological order
- `balance` is the running balance after the transaction
- `credit` = money in, `debit` = money out

---

### 7. **PaymentSchedule** Collection
**Purpose:** Manage recurring payment schedules

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| scheduleId | String | Unique, Required | Primary identifier |
| memberId | String | Required, FK → Member | Member reference |
| contributionAmount | Number | Required | Scheduled amount (₱) |
| frequency | String | Enum: monthly, quarterly, semi-annual, annual | Payment frequency |
| dueDay | Number | Default: 15 | Day of month due |
| nextDueDate | Date | Required | Next payment due date |
| lastPaymentDate | Date | Nullable | Last payment date |
| status | String | Enum: active, inactive, suspended | Schedule status |
| reminderSent | Boolean | Default: false | Reminder sent flag |
| reminderSentDate | Date | Nullable | Reminder sent timestamp |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `memberId` → **Member.memberId**

---

## 📅 ATTENDANCE MODULE COLLECTIONS

### 8. **Event** Collection
**Purpose:** Manage cooperative events

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| eventId | String | Unique, Required | Primary identifier |
| eventName | String | Required | Event name |
| eventDate | Date | Required | Event date |
| eventTime | String | Required | Event time |
| location | String | Required | Event location |
| description | String | Optional | Event description |
| status | String | Enum: upcoming, ongoing, completed | Event status |
| createdBy | String | Required | Creator user ID |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- Referenced by: **Attendance**, **AttendanceReport**, **ScannerStation**, **ScanLog**

---

### 9. **Attendance** Collection
**Purpose:** Track member attendance at events

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| attendanceId | String | Unique, Required | Primary identifier |
| memberId | String | Required, FK → Member | Member reference |
| memberName | String | Required | Member name (denormalized) |
| phoneNumber | String | Optional | Contact number |
| eventId | String | Required, FK → Event | Event reference |
| eventName | String | Required | Event name (denormalized) |
| barangay | String | Required | Member's barangay |
| scanTime | Date | Default: now | Scan timestamp |
| status | String | Enum: present, absent | Attendance status |
| scannedBy | String | Optional | Scanner operator |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `memberId` → **Member.memberId**
- `eventId` → **Event.eventId**
- Referenced by: **AttendanceReport.attendanceDetails**

---

### 10. **AttendanceReport** Collection
**Purpose:** Generate attendance summary reports

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| reportId | String | Unique, Required | Primary identifier |
| eventId | String | Required, FK → Event | Event reference |
| eventName | String | Required | Event name |
| reportDate | Date | Default: now | Report generation date |
| totalMembers | Number | Default: 0 | Total members |
| presentCount | Number | Default: 0 | Present count |
| absentCount | Number | Default: 0 | Absent count |
| attendanceRate | Number | Default: 0 | Attendance percentage |
| attendanceDetails | [ObjectId] | FK → Attendance | Array of attendance records |
| generatedBy | String | Required | Report generator |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `eventId` → **Event.eventId**
- `attendanceDetails[]` → **Attendance._id** (MongoDB ObjectId reference)

---

### 11. **ScannerStation** Collection
**Purpose:** Manage QR scanner stations

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| stationId | String | Unique, Required | Primary identifier |
| stationName | String | Required | Station name |
| location | String | Required | Physical location |
| deviceId | String | Unique, Required | Device identifier |
| status | String | Enum: active, inactive, offline | Station status |
| lastHeartbeat | Date | Nullable | Last activity timestamp |
| currentEventId | String | FK → Event | Active event |
| scansCount | Number | Default: 0 | Total scans performed |
| ipAddress | String | Optional | Device IP address |
| userAgent | String | Optional | Device user agent |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `currentEventId` → **Event.eventId**
- Referenced by: **ScanLog**

---

### 12. **ScanLog** Collection
**Purpose:** Detailed QR scan audit trail

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| scanLogId | String | Unique, Required | Primary identifier |
| stationId | String | Required, FK → ScannerStation | Scanner station reference |
| memberId | String | Required, FK → Member | Member reference |
| eventId | String | Required, FK → Event | Event reference |
| qrCodeData | String | Required | Scanned QR data |
| scanTime | Date | Default: now | Scan timestamp |
| status | String | Enum: success, duplicate, invalid, error | Scan result |
| errorMessage | String | Nullable | Error details |
| deviceInfo | String | Optional | Device information |
| createdAt | Date | Auto | Record creation timestamp |
| updatedAt | Date | Auto | Record update timestamp |

**Relationships:**
- `stationId` → **ScannerStation.stationId**
- `memberId` → **Member.memberId**
- `eventId` → **Event.eventId**

---

## 🔗 RELATIONSHIP SUMMARY

### One-to-One Relationships
- **User** ↔ **Member** (via memberId)

### One-to-Many Relationships
- **Member** → **Contribution** (one member, many contributions)
- **Member** → **Ledger** (one member, many ledger entries)
- **Member** → **PaymentSchedule** (one member, one or more schedules)
- **Member** → **Attendance** (one member, many attendance records)
- **Event** → **Attendance** (one event, many attendees)
- **Event** → **AttendanceReport** (one event, one or more reports)
- **Event** → **ScannerStation** (one event, many stations)
- **ScannerStation** → **ScanLog** (one station, many scans)
- **ImportOperation** → **CredentialLog** (one import, many logs)

### Many-to-Many Relationships
- **AttendanceReport** ↔ **Attendance** (via attendanceDetails array)

---

## 📝 IMPORTANT NOTES FOR ERD CREATION

1. **Primary Keys:** All collections use custom string IDs (not MongoDB ObjectId) except for internal references
2. **Timestamps:** All collections have `createdAt` and `updatedAt` auto-generated fields
3. **Soft Deletes:** System uses status fields instead of hard deletes
4. **Denormalization:** Some fields (memberName, eventName) are duplicated for performance
5. **Sorting:** Always use `createdAt` for Ledger queries to ensure correct chronological order
6. **Payment Method:** Currently only supports 'cash' (enum with single value)
7. **Module Access:** Members can access multiple modules (attendance, mortuary)

---

## 🎨 SUGGESTED ERD VISUALIZATION

### Color Coding Recommendation:
- **Blue:** Shared/Core collections (User, Member, ImportOperation, CredentialLog)
- **Green:** Mortuary module (Contribution, Ledger, PaymentSchedule)
- **Orange:** Attendance module (Event, Attendance, AttendanceReport, ScannerStation, ScanLog)

### Cardinality Notation:
- Use crow's foot notation for relationships
- Show FK constraints with arrows
- Indicate required vs optional relationships

---

## 📊 COLLECTION COUNT: 12 Collections Total
- **Shared:** 4 collections
- **Mortuary:** 3 collections
- **Attendance:** 5 collections
