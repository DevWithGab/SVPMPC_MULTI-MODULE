# Server Scripts

This directory contains utility scripts for database management and system maintenance.

## Available Scripts

### 1. rebuildIndexes.js

Rebuilds all database indexes for optimal query performance.

**When to run:**
- After adding new indexes to models
- After database migration
- When experiencing slow queries
- During initial setup

**Usage:**
```bash
cd server
node scripts/rebuildIndexes.js
```

**What it does:**
- Connects to MongoDB
- Syncs indexes from model schemas
- Displays summary of all indexes
- Reports any errors

**Expected output:**
```
🔄 Starting index rebuild process...
✅ Connected to database

📊 Rebuilding indexes for Member...
   Found 3 existing indexes
   ✅ Member indexes rebuilt: 4 total
   Indexes: _id_, memberId_1, email_1, status_1

📊 Rebuilding indexes for Contribution...
   Found 2 existing indexes
   ✅ Contribution indexes rebuilt: 5 total
   Indexes: _id_, contributionId_1, memberId_1, status_1, paymentDate_-1

...

✨ Index rebuild complete!
```

---

### 2. seedUsers.js

Seeds initial user accounts for testing and development.

**Usage:**
```bash
cd server
node scripts/seedUsers.js
```

---

### 3. showCredentials.js

Displays user credentials for testing purposes.

**Usage:**
```bash
cd server
node scripts/showCredentials.js
```

---

## Environment Variables

Ensure your `.env` file is configured before running scripts:

```env
MONGODB_URI=mongodb://localhost:27017/svpmpc
PORT=5000
JWT_SECRET=your_secret_key
```

---

## Troubleshooting

### Script fails to connect to database

**Error:** `MongooseServerSelectionError: connect ECONNREFUSED`

**Solution:**
1. Ensure MongoDB is running
2. Check `MONGODB_URI` in `.env`
3. Verify network connectivity

### Permission errors

**Error:** `EACCES: permission denied`

**Solution:**
```bash
# On Windows (run as Administrator)
# On Linux/Mac
sudo node scripts/rebuildIndexes.js
```

### Index rebuild takes too long

**Cause:** Large dataset

**Solution:**
- Run during off-peak hours
- Consider running on a replica if in production
- Monitor progress in MongoDB logs

---

## Best Practices

1. **Backup first**: Always backup your database before running scripts
2. **Test environment**: Test scripts in development before production
3. **Monitor logs**: Watch for errors or warnings during execution
4. **Schedule maintenance**: Run index rebuilds during low-traffic periods
5. **Document changes**: Keep track of when scripts are run

---

## Adding New Scripts

When creating new scripts:

1. Add proper error handling
2. Include usage documentation
3. Use environment variables for configuration
4. Close database connections properly
5. Provide clear console output
6. Update this README

**Template:**
```javascript
require('dotenv').config();
const connectDB = require('../configs/db');

const myScript = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to database');
    
    // Your script logic here
    
    console.log('✨ Script complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

myScript();
```

---

## Support

For issues or questions about scripts, contact the development team.
