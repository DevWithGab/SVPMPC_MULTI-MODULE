# Pagination and Indexing Implementation Guide

This document explains the pagination and database indexing implementation in the SVPMPC Multi-Module system.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Indexes](#database-indexes)
3. [Backend Pagination](#backend-pagination)
4. [Frontend Pagination](#frontend-pagination)
5. [Usage Examples](#usage-examples)
6. [API Reference](#api-reference)

---

## Overview

### What Was Implemented

✅ **Database Indexes** - Added indexes to frequently queried fields for better performance
✅ **Backend Pagination** - Implemented pagination in all major API endpoints
✅ **Frontend Components** - Created reusable pagination UI components
✅ **Custom Hooks** - Built React hooks for managing pagination state

### Benefits

- **Performance**: Faster queries with database indexes
- **Scalability**: Handle large datasets without memory issues
- **User Experience**: Better navigation through large lists
- **Consistency**: Standardized pagination across all modules

---

## Database Indexes

### Added Indexes

#### Member Model (`server/shared/models/Member.js`)
```javascript
memberSchema.index({ email: 1 });
memberSchema.index({ status: 1 });
// Plus unique indexes on: memberId, qrCode
```

#### Contribution Model (`server/modules/mortuary/models/Contribution.js`)
```javascript
contributionSchema.index({ memberId: 1 });
contributionSchema.index({ status: 1 });
contributionSchema.index({ paymentDate: -1 });
contributionSchema.index({ memberId: 1, paymentDate: -1 }); // Compound index
```

#### Ledger Model (`server/modules/mortuary/models/Ledger.js`)
```javascript
ledgerSchema.index({ memberId: 1 });
ledgerSchema.index({ transactionType: 1 });
ledgerSchema.index({ transactionDate: -1 });
ledgerSchema.index({ memberId: 1, transactionDate: -1 }); // Compound index
```

#### Attendance Model (`server/modules/attendance/models/Attendance.js`)
```javascript
attendanceSchema.index({ memberId: 1 });
attendanceSchema.index({ eventId: 1 });
attendanceSchema.index({ scanTime: -1 });
attendanceSchema.index({ eventId: 1, scanTime: -1 }); // Compound index
attendanceSchema.index({ memberId: 1, eventId: 1 }); // Compound index
```

#### Event Model (`server/modules/attendance/models/Event.js`)
```javascript
eventSchema.index({ status: 1 });
eventSchema.index({ eventDate: -1 });
eventSchema.index({ status: 1, eventDate: -1 }); // Compound index
```

### Index Types

- **Single Field Index** (`{ field: 1 }`): Speeds up queries on a single field
- **Compound Index** (`{ field1: 1, field2: -1 }`): Optimizes queries using multiple fields
- **Unique Index**: Ensures field values are unique (e.g., memberId, email)
- **Sparse Index**: Only indexes documents that have the field (e.g., qrCode)

### Index Direction

- `1`: Ascending order
- `-1`: Descending order

---

## Backend Pagination

### Pagination Utility (`server/shared/utils/pagination.js`)

#### Functions

**1. getPaginationParams(query)**
```javascript
const { page, limit, skip } = getPaginationParams(req.query);
// Returns: { page: 1, limit: 10, skip: 0 }
```

**2. buildPaginatedResponse(data, total, page, limit)**
```javascript
const response = buildPaginatedResponse(items, 100, 1, 10);
// Returns:
// {
//   success: true,
//   data: [...],
//   pagination: {
//     total: 100,
//     page: 1,
//     limit: 10,
//     totalPages: 10,
//     hasNextPage: true,
//     hasPrevPage: false,
//     nextPage: 2,
//     prevPage: null
//   }
// }
```

### Updated Controllers

#### 1. Contribution Controller
```javascript
const getAllContributions = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Contribution.countDocuments(query);
  const contributions = await Contribution.find(query)
    .sort({ paymentDate: -1 })
    .skip(skip)
    .limit(limit);
  res.json(buildPaginatedResponse(contributions, total, page, limit));
};
```

#### 2. Ledger Controller
```javascript
const getAllLedger = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Ledger.countDocuments(query);
  const ledgerEntries = await Ledger.find(query)
    .sort({ transactionDate: -1 })
    .skip(skip)
    .limit(limit);
  res.json(buildPaginatedResponse(ledgerEntries, total, page, limit));
};
```

#### 3. Member Controller (Admin)
```javascript
const getAllMembers = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Member.countDocuments(query);
  const members = await Member.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  res.json(buildPaginatedResponse(members, total, page, limit));
};
```

#### 4. Attendance Controller
```javascript
const getAllAttendance = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Attendance.countDocuments();
  const attendance = await Attendance.find()
    .sort({ scanTime: -1 })
    .skip(skip)
    .limit(limit);
  res.json(buildPaginatedResponse(attendance, total, page, limit));
};
```

#### 5. Event Controller
```javascript
const getAllEvents = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Event.countDocuments(filter);
  const events = await Event.find(filter)
    .sort({ eventDate: -1 })
    .skip(skip)
    .limit(limit);
  res.json(buildPaginatedResponse(events, total, page, limit));
};
```

---

## Frontend Pagination

### Components

#### 1. Pagination Component (`client/src/components/ui/pagination.jsx`)

Main pagination control with page numbers and navigation buttons.

```jsx
import { Pagination } from '@/components/ui/pagination';

<Pagination
  currentPage={page}
  totalPages={10}
  onPageChange={setPage}
  hasNextPage={true}
  hasPrevPage={false}
/>
```

**Props:**
- `currentPage`: Current page number
- `totalPages`: Total number of pages
- `onPageChange`: Callback function when page changes
- `hasNextPage`: Boolean indicating if there's a next page
- `hasPrevPage`: Boolean indicating if there's a previous page
- `className`: Optional CSS classes

#### 2. PaginationInfo Component

Shows current page information (e.g., "Showing 1-10 of 100").

```jsx
import { PaginationInfo } from '@/components/ui/pagination';

<PaginationInfo
  currentPage={1}
  limit={10}
  total={100}
/>
```

#### 3. ItemsPerPageSelector Component

Allows users to change items per page.

```jsx
import { ItemsPerPageSelector } from '@/components/ui/pagination';

<ItemsPerPageSelector
  value={limit}
  onChange={setLimit}
  options={[10, 25, 50, 100]}
/>
```

### Custom Hook

#### usePagination Hook (`client/src/hooks/usePagination.js`)

Manages pagination state in React components.

```jsx
import { usePagination } from '@/hooks/usePagination';

const MyComponent = () => {
  const { page, limit, setPage, setLimit, reset } = usePagination(1, 10);
  
  // Use page and limit in your API calls
  // Call setPage(newPage) to change page
  // Call setLimit(newLimit) to change items per page
  // Call reset() to reset to initial values
};
```

---

## Usage Examples

### Example 1: Basic Pagination in a Component

```jsx
import React, { useState, useEffect } from 'react';
import { Pagination, PaginationInfo } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import api from '@/services/api';

const MemberList = () => {
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({});
  const { page, limit, setPage } = usePagination(1, 10);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await api.get(`/api/mortuary/admin/members?page=${page}&limit=${limit}`);
        setMembers(response.data.data);
        setPagination(response.data.pagination);
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    };
    fetchMembers();
  }, [page, limit]);

  return (
    <div>
      {/* Display members */}
      <table>
        {members.map(member => (
          <tr key={member.id}>
            <td>{member.name}</td>
          </tr>
        ))}
      </table>

      {/* Pagination controls */}
      <div className="flex justify-between items-center mt-4">
        <PaginationInfo
          currentPage={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
        />
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          hasNextPage={pagination.hasNextPage}
          hasPrevPage={pagination.hasPrevPage}
        />
      </div>
    </div>
  );
};
```

### Example 2: Pagination with Filters

```jsx
const ContributionList = () => {
  const [contributions, setContributions] = useState([]);
  const [pagination, setPagination] = useState({});
  const { page, limit, setPage } = usePagination(1, 25);
  const [status, setStatus] = useState('all');

  useEffect(() => {
    const fetchContributions = async () => {
      const params = new URLSearchParams({
        page,
        limit,
        ...(status !== 'all' && { status })
      });

      const response = await api.get(`/api/mortuary/contributions?${params}`);
      setContributions(response.data.data);
      setPagination(response.data.pagination);
    };
    fetchContributions();
  }, [page, limit, status]);

  return (
    <div>
      {/* Filter */}
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="all">All</option>
        <option value="paid">Paid</option>
        <option value="pending">Pending</option>
      </select>

      {/* List and pagination */}
      {/* ... */}
    </div>
  );
};
```

### Example 3: Client-Side Pagination (for small datasets)

```jsx
import { useMemo } from 'react';

const Reports = ({ contributions = [] }) => {
  const { page, limit, setPage } = usePagination(1, 10);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const data = contributions.slice(startIndex, endIndex);
    
    return {
      data,
      total: contributions.length,
      totalPages: Math.ceil(contributions.length / limit),
      hasNextPage: endIndex < contributions.length,
      hasPrevPage: page > 1
    };
  }, [contributions, page, limit]);

  return (
    <div>
      {/* Display data */}
      {paginatedData.data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={paginatedData.totalPages}
        onPageChange={setPage}
        hasNextPage={paginatedData.hasNextPage}
        hasPrevPage={paginatedData.hasPrevPage}
      />
    </div>
  );
};
```

---

## API Reference

### Query Parameters

All paginated endpoints support these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number to retrieve |
| `limit` | number | 10 | Number of items per page (max: 100) |

### Response Format

All paginated endpoints return this format:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

### Paginated Endpoints

#### Mortuary Module

- `GET /api/mortuary/contributions?page=1&limit=10`
- `GET /api/mortuary/ledger?page=1&limit=10`
- `GET /api/mortuary/ledger/:memberId?page=1&limit=10`
- `GET /api/mortuary/admin/members?page=1&limit=10`

#### Attendance Module

- `GET /api/attendance?page=1&limit=10`
- `GET /api/attendance/event/:eventId?page=1&limit=10`
- `GET /api/attendance/events?page=1&limit=10`

### Additional Filters

Many endpoints support additional filters:

```
GET /api/mortuary/contributions?page=1&limit=10&status=paid
GET /api/mortuary/admin/members?page=1&limit=10&status=active&search=john
GET /api/attendance/events?page=1&limit=10&status=active&location=Manila
```

---

## Performance Tips

### Backend

1. **Use Indexes**: Ensure indexes are created on frequently queried fields
2. **Limit Fields**: Use `.select()` to return only needed fields
3. **Avoid Large Limits**: Cap limit at 100 items per page
4. **Use Compound Indexes**: For queries with multiple filters

### Frontend

1. **Debounce Search**: Delay API calls when user types in search
2. **Cache Results**: Store previous pages to avoid re-fetching
3. **Show Loading States**: Display spinners during data fetch
4. **Reset Page on Filter**: Reset to page 1 when filters change

---

## Migration Notes

### For Existing Code

If you have existing code that fetches all data at once:

**Before:**
```javascript
const response = await api.get('/api/mortuary/contributions');
const contributions = response.data.data;
```

**After:**
```javascript
const [page, setPage] = useState(1);
const [pagination, setPagination] = useState({});

const response = await api.get(`/api/mortuary/contributions?page=${page}&limit=10`);
const contributions = response.data.data;
setPagination(response.data.pagination);
```

### Backward Compatibility

The pagination implementation maintains backward compatibility:
- Endpoints without `page` parameter default to page 1
- Response includes both `data` and legacy fields (where applicable)
- Existing components continue to work without changes

---

## Troubleshooting

### Issue: Indexes not working

**Solution**: Rebuild indexes in MongoDB
```javascript
// In MongoDB shell or script
db.members.reIndex();
db.contributions.reIndex();
db.ledgers.reIndex();
db.attendances.reIndex();
db.events.reIndex();
```

### Issue: Pagination not updating

**Solution**: Ensure page state changes trigger re-fetch
```javascript
useEffect(() => {
  fetchData();
}, [page, limit]); // Add dependencies
```

### Issue: Total count is slow

**Solution**: Use `countDocuments()` with same filter as query
```javascript
const total = await Model.countDocuments(filter); // Fast with indexes
```

---

## Future Enhancements

- [ ] Cursor-based pagination for real-time data
- [ ] Virtual scrolling for very large lists
- [ ] Server-side caching with Redis
- [ ] GraphQL pagination support
- [ ] Infinite scroll option

---

## Support

For questions or issues, contact the development team or refer to:
- MongoDB Indexing: https://docs.mongodb.com/manual/indexes/
- React Pagination Patterns: https://react.dev/learn

---

**Last Updated**: May 18, 2026
**Version**: 1.0.0
