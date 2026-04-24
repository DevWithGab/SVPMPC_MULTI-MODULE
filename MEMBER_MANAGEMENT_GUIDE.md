# Member Management System Guide

## Overview
The system now has a **unified member database** that is shared across both the **Attendance** and **Mortuary** modules. Super admins can create member accounts that automatically work in both systems.

## Key Features

### 1. **Shared Member Model**
- Located at: `server/shared/models/Member.js`
- Used by both Attendance and Mortuary modules
- Single source of truth for all member data

### 2. **Super Admin Capabilities**
Super admins can:
- Create individual member accounts
- Bulk upload members via CSV
- Update member information
- Deactivate members
- Reset member passwords
- View all members across both modules

## API Endpoints

### Base URL: `/api/admin`

### 1. Create Single Member
```http
POST /api/admin/members/create
```

**Request Body:**
```json
{
  "memberName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "phoneNumber": "09171234567",
  "barangay": "Barangay 1",
  "address": "123 Main St, City",
  "beneficiaries": "Maria Dela Cruz (Wife)",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "emergencyContact": {
    "name": "Maria Dela Cruz",
    "relationship": "Wife",
    "phoneNumber": "09179876543"
  },
  "modules": ["attendance", "mortuary"]
}
```

**Response:**
```json
{
  "message": "Member and account created successfully",
  "member": {
    "memberId": "MEM-1234567890",
    "memberName": "Juan Dela Cruz",
    "email": "juan@example.com",
    "phoneNumber": "09171234567",
    "status": "active"
  },
  "account": {
    "userId": "uuid-here",
    "username": "juan1234",
    "temporaryPassword": "Abc123!@#XYZ",
    "isTemporaryPassword": true
  }
}
```

### 2. Bulk Create Members
```http
POST /api/admin/members/bulk-create
```

**Request Body:**
```json
{
  "members": [
    {
      "memberName": "Juan Dela Cruz",
      "email": "juan@example.com",
      "phoneNumber": "09171234567",
      "barangay": "Barangay 1",
      "address": "123 Main St",
      "beneficiaries": "Maria Dela Cruz (Wife)",
      "modules": ["attendance", "mortuary"]
    },
    {
      "memberName": "Pedro Santos",
      "email": "pedro@example.com",
      "phoneNumber": "09181234567",
      "barangay": "Barangay 2",
      "address": "456 Oak Ave",
      "beneficiaries": "Ana Santos (Wife)",
      "modules": ["attendance", "mortuary"]
    }
  ]
}
```

**Response:**
```json
{
  "message": "Bulk member creation completed",
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "results": {
    "success": [
      {
        "memberId": "MEM-1234567890",
        "memberName": "Juan Dela Cruz",
        "email": "juan@example.com",
        "username": "juan1234",
        "temporaryPassword": "Abc123!@#XYZ"
      }
    ],
    "failed": []
  }
}
```

### 3. Get All Members
```http
GET /api/admin/members?status=active&module=attendance&search=juan&limit=50&page=1
```

**Query Parameters:**
- `status`: Filter by status (active, inactive, deceased)
- `module`: Filter by module access (attendance, mortuary)
- `search`: Search by name, email, or memberId
- `limit`: Number of results per page (default: 100)
- `page`: Page number (default: 1)

**Response:**
```json
{
  "members": [
    {
      "memberId": "MEM-1234567890",
      "memberName": "Juan Dela Cruz",
      "email": "juan@example.com",
      "phoneNumber": "09171234567",
      "barangay": "Barangay 1",
      "address": "123 Main St",
      "status": "active",
      "modules": ["attendance", "mortuary"],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

### 4. Update Member
```http
PUT /api/admin/members/:memberId
```

**Request Body:**
```json
{
  "phoneNumber": "09171111111",
  "address": "New Address 789",
  "status": "active"
}
```

### 5. Delete Member (Soft Delete)
```http
DELETE /api/admin/members/:memberId
```

Sets member status to "inactive" and deactivates their account.

### 6. Reset Member Password
```http
POST /api/admin/members/:memberId/reset-password
```

**Response:**
```json
{
  "message": "Password reset successfully",
  "username": "juan1234",
  "temporaryPassword": "NewPass123!@#"
}
```

## Frontend Integration

### Using the Admin API

```javascript
import { adminAPI } from './services/api';

// Create a single member
const createMember = async () => {
  try {
    const result = await adminAPI.createMember({
      memberName: "Juan Dela Cruz",
      email: "juan@example.com",
      phoneNumber: "09171234567",
      barangay: "Barangay 1",
      address: "123 Main St",
      beneficiaries: "Maria Dela Cruz (Wife)",
      modules: ["attendance", "mortuary"]
    });
    
    console.log('Member created:', result);
    // Send credentials to member via email/SMS
    console.log('Username:', result.account.username);
    console.log('Password:', result.account.temporaryPassword);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Bulk create members
const bulkCreate = async (membersArray) => {
  try {
    const result = await adminAPI.bulkCreateMembers(membersArray);
    console.log('Summary:', result.summary);
    console.log('Successful:', result.results.success);
    console.log('Failed:', result.results.failed);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Get all members
const getMembers = async () => {
  try {
    const result = await adminAPI.getAllMembers({
      status: 'active',
      module: 'attendance',
      search: 'juan',
      limit: 50,
      page: 1
    });
    
    console.log('Members:', result.members);
    console.log('Pagination:', result.pagination);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Update member
const updateMember = async (memberId) => {
  try {
    const result = await adminAPI.updateMember(memberId, {
      phoneNumber: "09171111111",
      address: "New Address"
    });
    console.log('Updated:', result);
  } catch (error) {
    console.error('Error:', error);
  }
};

// Reset password
const resetPassword = async (memberId) => {
  try {
    const result = await adminAPI.resetMemberPassword(memberId);
    console.log('New password:', result.temporaryPassword);
    // Send new password to member
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## CSV Upload Format

When uploading members via CSV, use this format:

```csv
memberName,email,phoneNumber,barangay,address,beneficiaries,dateOfBirth,gender
Juan Dela Cruz,juan@example.com,09171234567,Barangay 1,123 Main St,Maria Dela Cruz (Wife),1990-01-15,male
Pedro Santos,pedro@example.com,09181234567,Barangay 2,456 Oak Ave,Ana Santos (Wife),1985-03-20,male
Maria Garcia,maria@example.com,09191234567,Barangay 3,789 Pine Rd,Jose Garcia (Husband),1992-07-10,female
```

## Member Data Structure

### Shared Fields (Used by both modules)
- `memberId`: Unique identifier
- `memberName`: Full name
- `email`: Email address
- `phoneNumber`: Contact number
- `barangay`: Barangay location
- `address`: Full address
- `status`: active, inactive, or deceased
- `modules`: Array of accessible modules
- `dateOfBirth`: Birth date
- `gender`: male, female, or other
- `emergencyContact`: Emergency contact information

### Attendance-Specific Fields
- `qrCode`: QR code data
- `qrCodeUrl`: QR code image URL
- `qrCodeGenerated`: Boolean flag

### Mortuary-Specific Fields
- `beneficiaries`: List of beneficiaries
- `joinDate`: Date joined the mortuary fund

## Security Notes

1. **Temporary Passwords**: All newly created accounts have temporary passwords that must be changed on first login.

2. **Password Generation**: Passwords are automatically generated with:
   - 12 characters minimum
   - Mix of uppercase, lowercase, numbers, and special characters

3. **Username Generation**: Usernames are created from email + last 4 digits of memberId
   - Example: `juan@example.com` + `MEM-1234` = `juan1234`

4. **Soft Delete**: Members are never permanently deleted, only marked as inactive.

## Benefits of Unified System

1. **Single Registration**: Members register once and get access to both modules
2. **Consistent Data**: No data duplication or synchronization issues
3. **Easy Management**: Super admins manage all members from one place
4. **Shared Authentication**: One login works for both systems
5. **Module-Based Access**: Control which modules each member can access

## Next Steps

1. Create a Super Admin UI component for member management
2. Implement CSV upload interface
3. Add email/SMS notification for sending credentials
4. Create member profile management interface
5. Add audit logging for admin actions
