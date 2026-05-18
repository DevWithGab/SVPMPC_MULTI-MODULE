# Pagination Quick Reference Card

## 🚀 Quick Start

### Backend (Controller)

```javascript
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');

const getItems = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const total = await Model.countDocuments(query);
  const items = await Model.find(query).skip(skip).limit(limit);
  res.json(buildPaginatedResponse(items, total, page, limit));
};
```

### Frontend (Component)

```jsx
import { Pagination, PaginationInfo } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';

const MyComponent = () => {
  const { page, limit, setPage } = usePagination(1, 10);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    api.get(`/api/endpoint?page=${page}&limit=${limit}`)
      .then(res => {
        setData(res.data.data);
        setPagination(res.data.pagination);
      });
  }, [page, limit]);

  return (
    <>
      {/* Your data display */}
      <PaginationInfo {...pagination} />
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        hasNextPage={pagination.hasNextPage}
        hasPrevPage={pagination.hasPrevPage}
      />
    </>
  );
};
```

## 📊 Database Indexes

### Check if indexes exist
```javascript
// In MongoDB shell
db.members.getIndexes()
db.contributions.getIndexes()
db.ledgers.getIndexes()
db.attendances.getIndexes()
db.events.getIndexes()
```

### Rebuild indexes
```javascript
db.members.reIndex()
db.contributions.reIndex()
db.ledgers.reIndex()
db.attendances.reIndex()
db.events.reIndex()
```

## 🔗 API Endpoints with Pagination

| Endpoint | Query Params |
|----------|--------------|
| `/api/mortuary/contributions` | `?page=1&limit=10&status=paid` |
| `/api/mortuary/ledger` | `?page=1&limit=10&transactionType=contribution` |
| `/api/mortuary/ledger/:memberId` | `?page=1&limit=10` |
| `/api/mortuary/admin/members` | `?page=1&limit=10&status=active&search=john` |
| `/api/attendance` | `?page=1&limit=10` |
| `/api/attendance/event/:eventId` | `?page=1&limit=10` |
| `/api/attendance/events` | `?page=1&limit=10&status=active` |

## 📦 Response Format

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

## 🎨 UI Components

### Pagination
```jsx
<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={(page) => setPage(page)}
  hasNextPage={true}
  hasPrevPage={false}
/>
```

### PaginationInfo
```jsx
<PaginationInfo
  currentPage={1}
  limit={10}
  total={100}
/>
// Output: "Showing 1 to 10 of 100 results"
```

### ItemsPerPageSelector
```jsx
<ItemsPerPageSelector
  value={10}
  onChange={(limit) => setLimit(limit)}
  options={[10, 25, 50, 100]}
/>
```

## 🔧 Common Patterns

### Pattern 1: Server-Side Pagination
```jsx
// Fetch from API with pagination
const { page, limit, setPage } = usePagination(1, 10);
useEffect(() => {
  api.get(`/api/items?page=${page}&limit=${limit}`)
    .then(res => setData(res.data));
}, [page, limit]);
```

### Pattern 2: Client-Side Pagination
```jsx
// Paginate data already in memory
const paginatedData = useMemo(() => {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}, [items, page, limit]);
```

### Pattern 3: With Search/Filter
```jsx
const [search, setSearch] = useState('');
const { page, limit, setPage } = usePagination(1, 10);

useEffect(() => {
  setPage(1); // Reset to page 1 when search changes
}, [search]);

useEffect(() => {
  const params = new URLSearchParams({ page, limit, search });
  api.get(`/api/items?${params}`).then(res => setData(res.data));
}, [page, limit, search]);
```

## ⚡ Performance Tips

1. **Always use indexes** on queried fields
2. **Limit max page size** to 100 items
3. **Use compound indexes** for multi-field queries
4. **Debounce search inputs** (300-500ms)
5. **Show loading states** during fetch
6. **Cache previous pages** when possible

## 🐛 Debugging

### Check query performance
```javascript
// Add .explain() to see query plan
const result = await Model.find(query).skip(skip).limit(limit).explain('executionStats');
console.log(result.executionStats);
```

### Verify indexes are used
```javascript
// Look for "IXSCAN" in executionStats.executionStages
// "COLLSCAN" means no index is being used (slow!)
```

## 📝 Checklist for New Paginated Endpoint

- [ ] Add indexes to model
- [ ] Import pagination utils in controller
- [ ] Use `getPaginationParams(req.query)`
- [ ] Get total count with `countDocuments()`
- [ ] Apply `.skip(skip).limit(limit)` to query
- [ ] Return `buildPaginatedResponse()`
- [ ] Test with `?page=1&limit=10`
- [ ] Update frontend to use pagination hook
- [ ] Add `<Pagination>` component to UI
- [ ] Handle loading and error states

---

**Need more details?** See `PAGINATION_GUIDE.md`
