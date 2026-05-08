# Relational Database Schema Documentation
## SVMPC Cooperative Management System

**Database Type:** MongoDB (NoSQL) - Represented as Relational Schema  
**Total Tables:** 12  
**Modules:** Shared/Core, Mortuary, Attendance

---

## 📘 TABLE OF CONTENTS
1. [Shared/Core Tables](#sharedcore-tables)
2. [Mortuary Module Tables](#mortuary-module-tables)
3. [Attendance Module Tables](#attendance-module-tables)
4. [Relationships & Foreign Keys](#relationships--foreign-keys)
5. [Indexes](#indexes)
6. [SQL DDL Statements](#sql-ddl-statements)

---

## SHARED/CORE TABLES

### Table 1: `users`
**Purpose:** User authentication and authorization

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| user_id | VARCHAR(50) | PRIMARY KEY | - | Unique user identifier |
| member_id | VARCHAR(50) | UNIQUE, NOT NULL, FK | - | References members(member_id) |
| username | VARCHAR(100) | UNIQUE, NOT NULL | - | Login username |
| email | VARCHAR(255) | NOT NULL | - | User email address |
| phone_number | VARCHAR(20) | NOT NULL | - | Contact number |
| password_hash | VARCHAR(255) | NOT NULL | - | Bcrypt hashed password |
| is_temporary_password | BOOLEAN | NOT NULL | TRUE | Requires password change |
| last_password_change_date | TIMESTAMP | NULL | NULL | Last password update |
| last_login_date | TIMESTAMP | NULL | NULL | Last login timestamp |
| status | ENUM | NOT NULL | 'active' | 'active', 'inactive', 'suspended' |
| modules | JSON | NOT NULL | ['attendance','mortuary'] | Accessible modules array |
| role | ENUM | NOT NULL | 'member' | 'member', 'admin', 'secretary', 'treasurer', 'super_admin' |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `user_id`
- UNIQUE: `member_id`, `username`
- INDEX: `email`, `status`, `role`

---

### Table 2: `members`
**Purpose:** Core member information shared across all modules

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| member_id | VARCHAR(50) | PRIMARY KEY | - | Unique member identifier (e.g., M001) |
| member_name | VARCHAR(255) | NOT NULL | - | Full name |
| email | VARCHAR(255) | NOT NULL | - | Email address |
| phone_number | VARCHAR(20) | NOT NULL | - | Contact number |
| barangay | VARCHAR(100) | NOT NULL | - | Barangay/district |
| address | TEXT | NOT NULL | - | Full address |
| qr_code | VARCHAR(255) | UNIQUE, NULL | NULL | QR code data (Attendance module) |
| qr_code_url | VARCHAR(500) | NULL | NULL | QR code image URL |
| qr_code_generated | BOOLEAN | NOT NULL | FALSE | QR generation status |
| beneficiaries | TEXT | NULL | NULL | Beneficiary information (Mortuary) |
| join_date | DATE | NOT NULL | CURRENT_DATE | Membership start date |
| status | ENUM | NOT NULL | 'active' | 'active', 'inactive', 'deceased', 'staff' |
| date_of_birth | DATE | NULL | NULL | Birth date |
| gender | ENUM | NULL | NULL | 'male', 'female', 'other' |
| emergency_contact_name | VARCHAR(255) | NULL | NULL | Emergency contact name |
| emergency_contact_relationship | VARCHAR(100) | NULL | NULL | Relationship to member |
| emergency_contact_phone | VARCHAR(20) | NULL | NULL | Emergency contact phone |
| modules | JSON | NOT NULL | ['attendance','mortuary'] | Module access array |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `member_id`
- UNIQUE: `qr_code` (sparse/partial)
- INDEX: `email`, `status`, `barangay`

---

### Table 3: `import_operations`
**Purpose:** Track bulk member import operations

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| operation_id | VARCHAR(50) | PRIMARY KEY | - | Unique operation identifier |
| file_name | VARCHAR(255) | NOT NULL | - | Uploaded CSV filename |
| status | ENUM | NOT NULL | 'preview' | 'preview', 'processing', 'completed', 'failed' |
| total_rows | INT | NOT NULL | 0 | Total rows in CSV |
| success_count | INT | NOT NULL | 0 | Successfully imported |
| failure_count | INT | NOT NULL | 0 | Failed imports |
| duplicate_count | INT | NOT NULL | 0 | Duplicate entries |
| emails_sent | INT | NOT NULL | 0 | Emails sent count |
| emails_failed | INT | NOT NULL | 0 | Email failures |
| sms_sent | INT | NOT NULL | 0 | SMS sent count |
| sms_failed | INT | NOT NULL | 0 | SMS failures |
| preview_data | JSON | NULL | NULL | Preview of import data |
| row_errors | JSON | NULL | NULL | Row-level errors |
| created_users | JSON | NULL | NULL | Created user accounts |
| created_by | VARCHAR(50) | NOT NULL | - | Admin who initiated |
| started_at | TIMESTAMP | NULL | NULL | Operation start time |
| completed_at | TIMESTAMP | NULL | NULL | Operation end time |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `operation_id`
- INDEX: `status`, `created_by`, `created_at`

---

### Table 4: `credential_logs`
**Purpose:** Track credential generation and distribution

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| log_id | VARCHAR(50) | PRIMARY KEY | - | Unique log identifier |
| user_id | VARCHAR(50) | NOT NULL, FK | - | References users(user_id) |
| member_id | VARCHAR(50) | NOT NULL | - | Member identifier |
| action | ENUM | NOT NULL | - | 'generated', 'resent', 'password_changed', 'password_reset' |
| sent_method | JSON | NULL | NULL | Array: ['email', 'sms'] |
| sent_date | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Sent timestamp |
| status | ENUM | NOT NULL | 'success' | 'success', 'failed', 'partial' |
| failure_reason | TEXT | NULL | NULL | Error message |
| operation_id | VARCHAR(50) | NULL, FK | NULL | References import_operations(operation_id) |
| attempt_number | INT | NOT NULL | 1 | Retry attempt count |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `log_id`
- FOREIGN KEY: `user_id` → `users(user_id)`
- FOREIGN KEY: `operation_id` → `import_operations(operation_id)`
- INDEX: `member_id`, `action`, `status`

---

## MORTUARY MODULE TABLES

### Table 5: `contributions`
**Purpose:** Track member contributions/payments

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| contribution_id | VARCHAR(50) | PRIMARY KEY | - | Unique identifier (e.g., CONTRIB-xxx) |
| member_id | VARCHAR(50) | NOT NULL, FK | - | References members(member_id) |
| amount | DECIMAL(10,2) | NOT NULL | - | Payment amount in pesos |
| payment_date | DATE | NOT NULL | CURRENT_DATE | Payment date |
| due_date | DATE | NOT NULL | - | Due date |
| status | ENUM | NOT NULL | 'paid' | 'paid', 'pending', 'overdue' |
| payment_method | ENUM | NOT NULL | 'cash' | 'cash' (only option) |
| reference_number | VARCHAR(100) | NULL | NULL | Transaction reference |
| notes | TEXT | NULL | NULL | Additional notes |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `contribution_id`
- FOREIGN KEY: `member_id` → `members(member_id)`
- INDEX: `member_id`, `payment_date`, `status`

---

### Table 6: `ledger`
**Purpose:** Complete transaction history and balance tracking

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| ledger_id | VARCHAR(50) | PRIMARY KEY | - | Unique identifier (UUID) |
| member_id | VARCHAR(50) | NOT NULL, FK | - | References members(member_id) |
| transaction_type | ENUM | NOT NULL | - | 'contribution', 'payout', 'adjustment', 'penalty', 'automatic_deduction' |
| description | TEXT | NOT NULL | - | Transaction description |
| credit | DECIMAL(10,2) | NOT NULL | 0.00 | Amount added (money in) |
| debit | DECIMAL(10,2) | NOT NULL | 0.00 | Amount deducted (money out) |
| balance | DECIMAL(10,2) | NOT NULL | - | Running balance after transaction |
| reference_id | VARCHAR(50) | NULL | NULL | Reference to source transaction |
| transaction_date | DATE | NOT NULL | CURRENT_DATE | Transaction date |
| recorded_by | VARCHAR(50) | NULL | NULL | User who recorded |
| beneficiary | VARCHAR(255) | NULL | NULL | Payout beneficiary name |
| payment_method | ENUM | NULL | 'cash' | 'cash' |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | **IMPORTANT: Use for sorting** |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `ledger_id`
- FOREIGN KEY: `member_id` → `members(member_id)`
- INDEX: `member_id`, `transaction_type`, `transaction_date`
- **CRITICAL INDEX:** `member_id, created_at DESC` (for balance queries)

**Important Notes:**
- Always sort by `created_at` DESC to get correct chronological order
- `balance` is the running balance AFTER the transaction
- `credit` = money in, `debit` = money out

---

### Table 7: `payment_schedules`
**Purpose:** Manage recurring payment schedules

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| schedule_id | VARCHAR(50) | PRIMARY KEY | - | Unique schedule identifier |
| member_id | VARCHAR(50) | NOT NULL, FK | - | References members(member_id) |
| contribution_amount | DECIMAL(10,2) | NOT NULL | - | Scheduled amount in pesos |
| frequency | ENUM | NOT NULL | 'monthly' | 'monthly', 'quarterly', 'semi-annual', 'annual' |
| due_day | INT | NOT NULL | 15 | Day of month due (1-31) |
| next_due_date | DATE | NOT NULL | - | Next payment due date |
| last_payment_date | DATE | NULL | NULL | Last payment date |
| status | ENUM | NOT NULL | 'active' | 'active', 'inactive', 'suspended' |
| reminder_sent | BOOLEAN | NOT NULL | FALSE | Reminder sent flag |
| reminder_sent_date | TIMESTAMP | NULL | NULL | Reminder sent timestamp |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `schedule_id`
- FOREIGN KEY: `member_id` → `members(member_id)`
- INDEX: `member_id`, `status`, `next_due_date`

---

## ATTENDANCE MODULE TABLES

### Table 8: `events`
**Purpose:** Manage cooperative events

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| event_id | VARCHAR(50) | PRIMARY KEY | - | Unique event identifier |
| event_name | VARCHAR(255) | NOT NULL | - | Event name |
| event_date | DATE | NOT NULL | - | Event date |
| event_time | VARCHAR(20) | NOT NULL | - | Event time (e.g., "14:00") |
| location | VARCHAR(255) | NOT NULL | - | Event location |
| description | TEXT | NULL | NULL | Event description |
| status | ENUM | NOT NULL | 'upcoming' | 'upcoming', 'ongoing', 'completed' |
| created_by | VARCHAR(50) | NOT NULL | - | Creator user ID |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `event_id`
- INDEX: `event_date`, `status`, `created_by`

---

### Table 9: `attendance`
**Purpose:** Track member attendance at events

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| attendance_id | VARCHAR(50) | PRIMARY KEY | - | Unique attendance identifier |
| member_id | VARCHAR(50) | NOT NULL, FK | - | References members(member_id) |
| member_name | VARCHAR(255) | NOT NULL | - | Member name (denormalized) |
| phone_number | VARCHAR(20) | NULL | NULL | Contact number |
| event_id | VARCHAR(50) | NOT NULL, FK | - | References events(event_id) |
| event_name | VARCHAR(255) | NOT NULL | - | Event name (denormalized) |
| barangay | VARCHAR(100) | NOT NULL | - | Member's barangay |
| scan_time | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Scan timestamp |
| status | ENUM | NOT NULL | 'present' | 'present', 'absent' |
| scanned_by | VARCHAR(50) | NULL | NULL | Scanner operator |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `attendance_id`
- FOREIGN KEY: `member_id` → `members(member_id)`
- FOREIGN KEY: `event_id` → `events(event_id)`
- INDEX: `event_id`, `member_id`, `scan_time`
- UNIQUE INDEX: `event_id, member_id` (prevent duplicate attendance)

---

### Table 10: `attendance_reports`
**Purpose:** Generate attendance summary reports

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| report_id | VARCHAR(50) | PRIMARY KEY | - | Unique report identifier |
| event_id | VARCHAR(50) | NOT NULL, FK | - | References events(event_id) |
| event_name | VARCHAR(255) | NOT NULL | - | Event name |
| report_date | DATE | NOT NULL | CURRENT_DATE | Report generation date |
| total_members | INT | NOT NULL | 0 | Total members |
| present_count | INT | NOT NULL | 0 | Present count |
| absent_count | INT | NOT NULL | 0 | Absent count |
| attendance_rate | DECIMAL(5,2) | NOT NULL | 0.00 | Attendance percentage |
| attendance_details | JSON | NULL | NULL | Array of attendance IDs |
| generated_by | VARCHAR(50) | NOT NULL | - | Report generator |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `report_id`
- FOREIGN KEY: `event_id` → `events(event_id)`
- INDEX: `event_id`, `report_date`, `generated_by`

---

### Table 11: `scanner_stations`
**Purpose:** Manage QR scanner stations

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| station_id | VARCHAR(50) | PRIMARY KEY | - | Unique station identifier |
| station_name | VARCHAR(255) | NOT NULL | - | Station name |
| location | VARCHAR(255) | NOT NULL | - | Physical location |
| device_id | VARCHAR(100) | UNIQUE, NOT NULL | - | Device identifier |
| status | ENUM | NOT NULL | 'inactive' | 'active', 'inactive', 'offline' |
| last_heartbeat | TIMESTAMP | NULL | NULL | Last activity timestamp |
| current_event_id | VARCHAR(50) | NULL, FK | NULL | References events(event_id) |
| scans_count | INT | NOT NULL | 0 | Total scans performed |
| ip_address | VARCHAR(45) | NULL | NULL | Device IP address (IPv4/IPv6) |
| user_agent | TEXT | NULL | NULL | Device user agent |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `station_id`
- UNIQUE: `device_id`
- FOREIGN KEY: `current_event_id` → `events(event_id)`
- INDEX: `status`, `location`

---

### Table 12: `scan_logs`
**Purpose:** Detailed QR scan audit trail

| Column Name | Data Type | Constraints | Default | Description |
|------------|-----------|-------------|---------|-------------|
| scan_log_id | VARCHAR(50) | PRIMARY KEY | - | Unique scan log identifier |
| station_id | VARCHAR(50) | NOT NULL, FK | - | References scanner_stations(station_id) |
| member_id | VARCHAR(50) | NOT NULL, FK | - | References members(member_id) |
| event_id | VARCHAR(50) | NOT NULL, FK | - | References events(event_id) |
| qr_code_data | TEXT | NOT NULL | - | Scanned QR data |
| scan_time | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Scan timestamp |
| status | ENUM | NOT NULL | 'success' | 'success', 'duplicate', 'invalid', 'error' |
| error_message | TEXT | NULL | NULL | Error details |
| device_info | TEXT | NULL | NULL | Device information |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record update time |

**Indexes:**
- PRIMARY KEY: `scan_log_id`
- FOREIGN KEY: `station_id` → `scanner_stations(station_id)`
- FOREIGN KEY: `member_id` → `members(member_id)`
- FOREIGN KEY: `event_id` → `events(event_id)`
- INDEX: `station_id`, `event_id`, `scan_time`, `status`

---

## RELATIONSHIPS & FOREIGN KEYS

### One-to-One Relationships
```
users.member_id → members.member_id (1:1)
```

### One-to-Many Relationships
```
members.member_id → users.member_id (1:1)
members.member_id → contributions.member_id (1:N)
members.member_id → ledger.member_id (1:N)
members.member_id → payment_schedules.member_id (1:N)
members.member_id → attendance.member_id (1:N)
members.member_id → scan_logs.member_id (1:N)

events.event_id → attendance.event_id (1:N)
events.event_id → attendance_reports.event_id (1:N)
events.event_id → scanner_stations.current_event_id (1:N)
events.event_id → scan_logs.event_id (1:N)

scanner_stations.station_id → scan_logs.station_id (1:N)

import_operations.operation_id → credential_logs.operation_id (1:N)
```

### Referential Integrity Rules
- **ON DELETE CASCADE:** attendance, scan_logs (when member/event deleted)
- **ON DELETE SET NULL:** scanner_stations.current_event_id (when event deleted)
- **ON DELETE RESTRICT:** users (cannot delete if member exists), contributions, ledger

---

## INDEXES

### Primary Indexes (Automatically Created)
All tables have PRIMARY KEY indexes on their ID columns.

### Foreign Key Indexes (Recommended)
```sql
-- Users
CREATE INDEX idx_users_member_id ON users(member_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- Members
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_barangay ON members(barangay);

-- Contributions
CREATE INDEX idx_contributions_member_id ON contributions(member_id);
CREATE INDEX idx_contributions_payment_date ON contributions(payment_date);
CREATE INDEX idx_contributions_status ON contributions(status);

-- Ledger (CRITICAL)
CREATE INDEX idx_ledger_member_created ON ledger(member_id, created_at DESC);
CREATE INDEX idx_ledger_transaction_type ON ledger(transaction_type);

-- Attendance
CREATE INDEX idx_attendance_event_id ON attendance(event_id);
CREATE INDEX idx_attendance_member_id ON attendance(member_id);
CREATE UNIQUE INDEX idx_attendance_event_member ON attendance(event_id, member_id);

-- Scan Logs
CREATE INDEX idx_scan_logs_station_id ON scan_logs(station_id);
CREATE INDEX idx_scan_logs_event_id ON scan_logs(event_id);
CREATE INDEX idx_scan_logs_scan_time ON scan_logs(scan_time);
```

---

## SQL DDL STATEMENTS

### Create Database
```sql
CREATE DATABASE svmpc_cooperative;
USE svmpc_cooperative;
```

### Table Creation Order (Respecting Foreign Keys)
```sql
-- 1. Core tables (no dependencies)
CREATE TABLE members (...);
CREATE TABLE import_operations (...);
CREATE TABLE events (...);

-- 2. Tables with single dependency
CREATE TABLE users (...);
CREATE TABLE contributions (...);
CREATE TABLE ledger (...);
CREATE TABLE payment_schedules (...);
CREATE TABLE attendance (...);
CREATE TABLE attendance_reports (...);
CREATE TABLE scanner_stations (...);

-- 3. Tables with multiple dependencies
CREATE TABLE credential_logs (...);
CREATE TABLE scan_logs (...);
```

### Sample CREATE TABLE Statement
```sql
CREATE TABLE members (
    member_id VARCHAR(50) PRIMARY KEY,
    member_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    qr_code VARCHAR(255) UNIQUE,
    qr_code_url VARCHAR(500),
    qr_code_generated BOOLEAN NOT NULL DEFAULT FALSE,
    beneficiaries TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status ENUM('active', 'inactive', 'deceased', 'staff') NOT NULL DEFAULT 'active',
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    emergency_contact_name VARCHAR(255),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    modules JSON NOT NULL DEFAULT ('["attendance","mortuary"]'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_barangay (barangay)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Sample Foreign Key Constraint
```sql
ALTER TABLE users
ADD CONSTRAINT fk_users_member
FOREIGN KEY (member_id) REFERENCES members(member_id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE contributions
ADD CONSTRAINT fk_contributions_member
FOREIGN KEY (member_id) REFERENCES members(member_id)
ON DELETE CASCADE
ON UPDATE CASCADE;
```

---

## ENTITY RELATIONSHIP DIAGRAM (ERD) NOTATION

### Cardinality Symbols
```
1:1  (One-to-One)     ──────|──────
1:N  (One-to-Many)    ──────|──<──
N:M  (Many-to-Many)   ──<───|──>──
```

### Relationship Map
```
┌─────────┐ 1:1  ┌─────────┐
│  users  │──────│ members │
└─────────┘      └─────────┘
                      │
                      │ 1:N
        ┌─────────────┼─────────────┬─────────────┐
        │             │             │             │
        ▼             ▼             ▼             ▼
┌──────────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐
│contributions │ │ ledger │ │ attendance │ │ scan_logs  │
└──────────────┘ └────────┘ └────────────┘ └────────────┘
                                  ▲              ▲
                                  │              │
                                  │ 1:N          │ 1:N
                            ┌─────────┐    ┌──────────────┐
                            │ events  │────│scanner_      │
                            └─────────┘    │stations      │
                                           └──────────────┘
```

---

## NOTES FOR DATABASE IMPLEMENTATION

1. **Character Set:** Use `utf8mb4` for full Unicode support (including emojis)
2. **Collation:** Use `utf8mb4_unicode_ci` for case-insensitive comparisons
3. **Engine:** Use InnoDB for transaction support and foreign keys
4. **Timestamps:** All tables include `created_at` and `updated_at`
5. **Soft Deletes:** Use status fields instead of hard deletes
6. **JSON Fields:** Store arrays and objects as JSON (supported in MySQL 5.7+, PostgreSQL, MongoDB)
7. **Decimal Precision:** Use DECIMAL(10,2) for currency (supports up to ₱99,999,999.99)
8. **Date vs Timestamp:** Use DATE for dates only, TIMESTAMP for date+time
9. **VARCHAR Lengths:** Adjust based on actual data requirements
10. **Performance:** Add indexes on frequently queried columns

---

## DATABASE SIZE ESTIMATES

### Estimated Row Counts (1000 members, 5 years)
- members: 1,000 rows
- users: 1,000 rows
- contributions: 60,000 rows (5 contributions/member/year)
- ledger: 65,000 rows (contributions + deductions + adjustments)
- attendance: 50,000 rows (10 events/year)
- events: 50 rows
- scan_logs: 50,000 rows
- Other tables: < 1,000 rows each

### Estimated Database Size
- Total: ~500 MB - 1 GB (with indexes)
- Growth: ~100 MB/year

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-06  
**Database Schema Version:** 1.0
