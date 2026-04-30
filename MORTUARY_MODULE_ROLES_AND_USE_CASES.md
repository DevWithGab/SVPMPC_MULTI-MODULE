# MORTUARY MODULE - Roles and Use Cases Documentation

## System Overview
**Module Name**: Mortuary Services Management System  
**Purpose**: Manage cooperative mortuary fund contributions, member balances, and financial operations  
**Last Updated**: April 26, 2026

---

## 🎭 ACTORS (User Roles)

### 1. **TREASURER / STAFF** 👨‍💼
**Role Code**: `TRS`  
**Access Level**: Financial Management  
**Primary Responsibility**: Manage day-to-day fund operations, contributions, and member balances

### 2. **ADMIN** 👑
**Role Code**: `ADM`  
**Access Level**: Full Administrative Access  
**Primary Responsibility**: Overall system management, member administration, and financial oversight

---

## 📋 USE CASES BY ROLE

## TREASURER / STAFF USE CASES

### 📊 Dashboard & Overview
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-001 | View Dashboard | View fund balance, total members, recent transactions, and key statistics |
| TR-UC-002 | View Fund Summary | Monitor total fund balance and financial health |
| TR-UC-003 | View Recent Activities | Track latest contributions and deductions |

### 💰 Member Balance Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-004 | View All Member Balances | Display list of all members with their current balances |
| TR-UC-005 | Search Member Balance | Search for specific member's balance by name or ID |
| TR-UC-006 | Filter Members by Balance | Filter members by balance status (low balance, sufficient, etc.) |
| TR-UC-007 | View Member Ledger | View detailed transaction history for a specific member |
| TR-UC-008 | Check Low Balance Members | Identify members with balance below ₱1,000 threshold |

### 💸 Automatic Deduction System
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-009 | Trigger Death Deduction | Initiate automatic ₱25 deduction from all active members |
| TR-UC-010 | Process Custom Bulk Deduction | Apply custom deduction amount to selected members |
| TR-UC-011 | View Deduction History | Review past automatic deductions and their details |

### 💵 Contribution Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-012 | Record New Payment | Manually record member contribution payment |
| TR-UC-013 | View All Contributions | Display complete list of all member contributions |
| TR-UC-014 | Search Contributions | Search contributions by member name, date, or amount |
| TR-UC-015 | Filter Contributions by Status | Filter by paid/pending status |
| TR-UC-016 | Filter Contributions by Date | Filter contributions by date range |
| TR-UC-017 | Export Contributions to CSV | Download contribution records for external use |

### 💀 Death Verification & Processing
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-018 | Record Death Verification | Register member death and initiate fund processing |
| TR-UC-019 | View Death Verification List | Display all recorded death verifications |
| TR-UC-020 | Update Death Verification Status | Modify verification status (pending, verified, processed) |
| TR-UC-021 | Process Death Benefits | Calculate and process death benefit payouts |

### 📱 Notification Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-022 | Send Low Balance Notifications | Send SMS alerts to members with low balance |
| TR-UC-023 | Send Payment Reminders | Send contribution payment reminders to members |
| TR-UC-024 | Send Bulk SMS Notifications | Send custom SMS to multiple members |
| TR-UC-025 | View Notification History | Review sent notifications and their status |

### 📈 Reports & Analytics
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-026 | Generate Contribution Report | Create detailed contribution summary report |
| TR-UC-027 | Generate Balance Report | Create member balance status report |
| TR-UC-028 | Generate Deduction Report | Create automatic deduction summary report |
| TR-UC-029 | Generate Monthly Summary | Create monthly financial summary report |
| TR-UC-030 | Export Reports to PDF/CSV | Download reports in various formats |

### 🔍 Ledger Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| TR-UC-031 | View Complete Ledger | Display all financial transactions in the system |
| TR-UC-032 | View Member-Specific Ledger | Display transaction history for specific member |
| TR-UC-033 | Filter Ledger by Transaction Type | Filter by contribution, deduction, payout, etc. |
| TR-UC-034 | Filter Ledger by Date Range | Filter transactions by date period |
| TR-UC-035 | Search Ledger Entries | Search ledger by member, amount, or description |

---

## ADMIN USE CASES

### 📊 Dashboard & System Overview
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-001 | View Admin Dashboard | View comprehensive system statistics with charts and graphs |
| AD-UC-002 | Monitor Fund Growth | Track monthly fund balance and contribution trends |
| AD-UC-003 | View Recent Activities | Monitor latest contributions and payouts in real-time |
| AD-UC-004 | View Member Demographics | Analyze member distribution by status (pie chart) |
| AD-UC-005 | View Contribution Heatmap | Visualize daily contribution intensity across weeks |
| AD-UC-006 | Access Quick Actions | Navigate to key functions (Add Member, Record Payment, etc.) |
| AD-UC-007 | Monitor System Health | Track overall fund status and member statistics |
| AD-UC-008 | Backup System Data | Export complete system data for backup purposes |

### 👥 Member Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-009 | Add New Member | Register new member to mortuary fund system |
| AD-UC-010 | View All Members | Display complete member directory with balances |
| AD-UC-011 | Search Members | Search members by name, ID, or contact information |
| AD-UC-012 | Filter Members by Status | Filter by active/inactive/deceased status |
| AD-UC-013 | View Member Statistics | See total, active, inactive, and deceased member counts |
| AD-UC-014 | View Member Balance | Display current contribution balance for each member |
| AD-UC-015 | Update Member Information | Edit member details (name, contact, status) |
| AD-UC-016 | Delete Member | Remove member from system (with transaction validation) |
| AD-UC-017 | View Member Profile | Display detailed member information and history |
| AD-UC-018 | Send SMS to Member | Send manual SMS notification to specific member |
| AD-UC-019 | **Reset Member Password** | **Generate new temporary password and send via email/SMS** |
| AD-UC-020 | **View Reset Password Credentials** | **Display new username and temporary password after reset** |
| AD-UC-021 | Import Members from CSV | Bulk import members from CSV file |
| AD-UC-022 | Export Members to CSV | Download member list for external use |
| AD-UC-023 | View Member Join Date | Track when each member joined the fund |

### 💵 Contribution Management (Admin Level)
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-024 | Record Member Contribution | Manually record contribution payment with date |
| AD-UC-025 | View All Contributions | Display complete contribution history |
| AD-UC-026 | View Contribution Statistics | See total collected, monthly total, and pending count |
| AD-UC-027 | Search Contributions | Search by member name or contribution ID |
| AD-UC-028 | Filter Contributions by Status | Filter by paid/pending status |
| AD-UC-029 | Filter Contributions by Date | Filter contributions by date range |
| AD-UC-030 | View Contribution Details | Display detailed payment information |
| AD-UC-031 | Verify Pending Contributions | Approve or reject pending contributions |
| AD-UC-032 | Export Contribution Data | Download contribution records to CSV |
| AD-UC-033 | View Monthly Collection | Track contributions collected in current month |
| AD-UC-034 | View Total Collection | Monitor cumulative contributions collected |

### 💸 Payout Management
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-035 | Record New Payout | Register death benefit payout to beneficiary |
| AD-UC-036 | Specify Beneficiary | Enter beneficiary name for payout record |
| AD-UC-037 | Select Payment Method | Choose payment method (Cash, Bank Transfer, GCash, etc.) |
| AD-UC-038 | Enter Payout Amount | Specify payout amount to be disbursed |
| AD-UC-039 | Add Payout Description | Include notes or description for payout |
| AD-UC-040 | View All Payouts | Display complete payout history |
| AD-UC-041 | View Payout Details | Display detailed payout information |
| AD-UC-042 | Search Payouts | Search by member, beneficiary, or date |
| AD-UC-043 | Filter Payouts by Date | Filter payouts by date range |
| AD-UC-044 | View Payout Method | See payment method used for each payout |
| AD-UC-045 | Export Payout Records | Download payout data for auditing |
| AD-UC-046 | Track Total Payouts | Monitor cumulative payouts disbursed |

### 📈 Reports & Analytics (Admin Level)
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-047 | Select Report Type | Choose from Contribution, Payout, or Fund Balance reports |
| AD-UC-048 | Generate Contribution Report | Create detailed contribution summary report |
| AD-UC-049 | Generate Payout Report | Create payout disbursement report |
| AD-UC-050 | Generate Fund Balance Report | Create fund ledger statement |
| AD-UC-051 | Set Report Date Range | Specify date range for report generation |
| AD-UC-052 | Preview Report | View live preview of report before export |
| AD-UC-053 | Export Report to PDF | Download report in PDF format |
| AD-UC-054 | Export Report to CSV | Download report in CSV format |
| AD-UC-055 | View Report Metadata | See report generation date and parameters |
| AD-UC-056 | Generate Member Statistics | Create member demographic and status report |
| AD-UC-057 | Generate Contribution Analysis | Analyze contribution patterns and trends |
| AD-UC-058 | Generate Annual Report | Create yearly financial and operational report |

### ⚙️ System Settings
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-059 | Access System Settings | Navigate to system configuration panel |
| AD-UC-060 | Configure Financial Settings | Modify financial parameters and targets |
| AD-UC-061 | Set Annual Fund Goal | Define target fund balance for the year |
| AD-UC-062 | Set Base Monthly Contribution | Configure standard monthly contribution amount |
| AD-UC-063 | Set Minimum Balance Threshold | Configure low balance alert threshold (₱1,000) |
| AD-UC-064 | Set Deduction Amount | Configure automatic deduction amount (₱25) |
| AD-UC-065 | Save System Settings | Apply and save configuration changes |
| AD-UC-066 | View Current Settings | Display current system configuration |
| AD-UC-067 | Reset to Default Settings | Restore default system configuration |
| AD-UC-068 | Manage Notification Templates | Create/edit SMS notification templates |

### 🔄 System Administration
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AD-UC-069 | View System Statistics | Monitor overall system performance metrics |
| AD-UC-070 | Access All Modules | Navigate between Dashboard, Members, Contributions, Payouts, Reports, Settings |
| AD-UC-071 | Collapse/Expand Sidebar | Toggle sidebar for better screen space management |
| AD-UC-072 | Logout from System | End admin session and return to login |
| AD-UC-073 | View Fiscal Year Info | Display current fiscal year information |
| AD-UC-074 | Backup All Data | Export complete system data for backup |

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Common Use Cases (Both Roles)
| Use Case ID | Use Case Name | Description |
|-------------|---------------|-------------|
| AUTH-UC-001 | Login to System | Authenticate using username and password |
| AUTH-UC-002 | Logout from System | End current session and return to login |
| AUTH-UC-003 | Change Password | Update account password |
| AUTH-UC-004 | View Profile | Display current user profile information |

---

## 🔄 SYSTEM WORKFLOWS

### Workflow 1: Death Benefit Processing
```
1. Admin/Treasurer records death verification (TR-UC-018)
2. System triggers automatic ₱25 deduction from all members (TR-UC-009)
3. System sends low balance notifications if needed (TR-UC-022)
4. Admin records payout to beneficiary (AD-UC-020)
5. System updates member ledgers automatically
6. Treasurer generates deduction report (TR-UC-028)
```

### Workflow 2: New Member Registration
```
1. Admin adds new member (AD-UC-004)
2. System creates member profile and initial ledger
3. Admin records initial contribution (AD-UC-014)
4. System updates member balance
5. System sends welcome notification (optional)
```

### Workflow 3: Monthly Contribution Collection
```
1. Treasurer views members with pending contributions (TR-UC-014)
2. Treasurer sends payment reminders (TR-UC-023)
3. Members make payments
4. Treasurer records payments (TR-UC-012)
5. System updates member balances
6. Treasurer generates monthly report (TR-UC-029)
```

### Workflow 4: Low Balance Management
```
1. System automatically checks member balances
2. Treasurer views low balance members (TR-UC-008)
3. Treasurer sends low balance notifications (TR-UC-022)
4. Members make top-up contributions
5. Treasurer records contributions (TR-UC-012)
6. System updates balances
```

---

## 📊 ROLE COMPARISON MATRIX

| Feature/Function | Treasurer | Admin |
|------------------|-----------|-------|
| **Dashboard & Overview** |
| View Dashboard | ✅ | ✅ |
| View Fund Growth Chart | ❌ | ✅ |
| View Contribution Heatmap | ❌ | ✅ |
| View Member Demographics | ❌ | ✅ |
| Quick Actions Panel | ❌ | ✅ |
| **Member Management** |
| View Member List | ✅ | ✅ |
| View Member Balances | ✅ | ✅ |
| Search Members | ✅ | ✅ |
| Filter Members | ✅ | ✅ |
| **Add New Members** | ❌ | ✅ |
| **Edit Member Info** | ❌ | ✅ |
| **Delete Members** | ❌ | ✅ |
| **Reset Member Password** | ❌ | ✅ |
| **Send Password via Email/SMS** | ❌ | ✅ |
| **Import Members CSV** | ❌ | ✅ |
| Export Members CSV | ✅ | ✅ |
| Send SMS to Member | ✅ | ✅ |
| **Contribution Management** |
| Record Contributions | ✅ | ✅ |
| View All Contributions | ✅ | ✅ |
| Search Contributions | ✅ | ✅ |
| Filter Contributions | ✅ | ✅ |
| Export Contributions | ✅ | ✅ |
| View Statistics | ✅ | ✅ |
| **Deduction System** |
| Trigger Death Deduction | ✅ | ❌ |
| Custom Bulk Deduction | ✅ | ❌ |
| View Deduction History | ✅ | ❌ |
| **Payout Management** |
| **Record Payouts** | ❌ | ✅ |
| **View All Payouts** | ✅ | ✅ |
| **Specify Beneficiary** | ❌ | ✅ |
| **Select Payment Method** | ❌ | ✅ |
| **Notifications** |
| Send Low Balance Alerts | ✅ | ✅ |
| Send Payment Reminders | ✅ | ✅ |
| Send Bulk SMS | ✅ | ✅ |
| View Notification History | ✅ | ✅ |
| **Reports & Analytics** |
| Generate Reports | ✅ | ✅ |
| Select Report Type | ✅ | ✅ |
| Export to PDF | ✅ | ✅ |
| Export to CSV | ✅ | ✅ |
| View Report Preview | ❌ | ✅ |
| **Ledger Management** |
| View Complete Ledger | ✅ | ✅ |
| View Member Ledger | ✅ | ✅ |
| Filter Ledger | ✅ | ✅ |
| Search Ledger | ✅ | ✅ |
| **System Settings** |
| **Configure Settings** | ❌ | ✅ |
| **Set Annual Goal** | ❌ | ✅ |
| **Set Contribution Amount** | ❌ | ✅ |
| **Set Balance Threshold** | ❌ | ✅ |
| **Save Settings** | ❌ | ✅ |
| **Death Verification** |
| Record Death | ✅ | ✅ |
| View Verifications | ✅ | ✅ |
| Update Status | ✅ | ✅ |
| Process Benefits | ✅ | ✅ |

**Legend:**
- ✅ = Has Access
- ❌ = No Access
- **Bold** = Exclusive or Primary Function

---

## 🎯 KEY BUSINESS RULES

### Balance Management
1. Minimum balance threshold: **₱1,000**
2. Automatic deduction per death: **₱25**
3. Members below minimum balance receive SMS alerts
4. System prevents negative balances

### Contribution Rules
1. Contributions can be recorded manually by Treasurer/Admin
2. All contributions are logged in member ledger
3. Contribution status: Paid or Pending
4. Payment date is recorded for all contributions

### Payout Rules
1. Only Admin can record payouts
2. Payouts require beneficiary information
3. Payment method must be specified (Cash, Bank Transfer, GCash, etc.)
4. Payouts are deducted from member balance
5. All payouts are logged in ledger

### Member Status
1. **Active**: Regular contributing member
2. **Inactive**: Non-contributing member
3. **Deceased**: Member who has passed away

### Automatic Deduction
1. Triggered manually by Treasurer
2. Deducts ₱25 from all active members
3. Updates all member ledgers simultaneously
4. Generates transaction records
5. Sends notifications to low balance members

---

## 📱 NOTIFICATION TYPES

### SMS Notifications
1. **Low Balance Alert**: Sent when balance < ₱1,000
2. **Payment Reminder**: Monthly contribution reminder
3. **Deduction Notice**: After automatic deduction
4. **Payment Confirmation**: After contribution recorded
5. **Password Reset**: New temporary password sent to member phone
6. **Custom Message**: Manual SMS from Admin/Treasurer

### Email Notifications
1. **Password Reset**: New login credentials sent to member email
2. **Account Creation**: Welcome email with initial credentials
3. **System Announcements**: Important updates from admin

---

## 🔗 SYSTEM INTEGRATION POINTS

### Internal Integrations
- **Authentication System**: User login and authorization
- **Member Database**: Shared member information
- **Ledger System**: Financial transaction tracking
- **Notification Service**: SMS sending functionality

### External Integrations
- **SMS Gateway**: For sending notifications
- **CSV Import/Export**: For bulk operations
- **PDF Generator**: For report generation

---

## 📝 NOTES FOR USE CASE DIAGRAM

### Primary Actors
1. **Treasurer** (Main operational role)
2. **Admin** (Supervisory and management role)

### System Boundary
- Mortuary Services Management System

### Include Relationships
- Login (included in all use cases)
- View Member Balance (included in many operations)
- Update Ledger (included in financial transactions)

### Extend Relationships
- Send Notification (extends Record Contribution)
- Generate Report (extends View Data operations)
- Export Data (extends View List operations)

### Generalization
- Record Contribution (generalized from Treasurer and Admin)
- View Dashboard (generalized from Treasurer and Admin)
- Send Notifications (generalized from Treasurer and Admin)

---

## 🎨 SUGGESTED USE CASE DIAGRAM STRUCTURE

```
┌─────────────────────────────────────────────────────────┐
│         MORTUARY SERVICES MANAGEMENT SYSTEM             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TREASURER                    ADMIN                     │
│     │                           │                       │
│     ├─ View Dashboard ──────────┤                       │
│     ├─ Manage Balances          │                       │
│     ├─ Record Contributions ────┤                       │
│     ├─ Trigger Deductions       │                       │
│     ├─ Send Notifications ──────┤                       │
│     ├─ Generate Reports ────────┤                       │
│     ├─ View Ledger ─────────────┤                       │
│     └─ Death Verification ──────┤                       │
│                                 │                       │
│                                 ├─ Manage Members       │
│                                 ├─ Record Payouts       │
│                                 └─ System Settings      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📞 SUPPORT INFORMATION

**For Use Case Diagram Questions:**
- Review this document for complete role definitions
- Check workflow diagrams for process flows
- Refer to role comparison matrix for access levels

**System Version**: 2.0  
**Documentation Date**: April 26, 2026  
**Module Status**: Active (Member Portal Removed)

---

**END OF DOCUMENT**
