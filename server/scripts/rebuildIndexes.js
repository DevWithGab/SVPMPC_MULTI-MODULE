/**
 * Rebuild Database Indexes Script
 * 
 * This script rebuilds all indexes for the SVPMPC database models.
 * Run this after adding new indexes to ensure they are created in MongoDB.
 * 
 * Usage: node server/scripts/rebuildIndexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../configs/db');

// Import all models
const { Member } = require('../shared/models');
const Contribution = require('../modules/mortuary/models/Contribution');
const Ledger = require('../modules/mortuary/models/Ledger');
const Attendance = require('../modules/attendance/models/Attendance');
const Event = require('../modules/attendance/models/Event');

const rebuildIndexes = async () => {
  try {
    console.log('🔄 Starting index rebuild process...\n');

    // Connect to database
    await connectDB();
    console.log('✅ Connected to database\n');

    // List of models to rebuild indexes for
    const models = [
      { name: 'Member', model: Member },
      { name: 'Contribution', model: Contribution },
      { name: 'Ledger', model: Ledger },
      { name: 'Attendance', model: Attendance },
      { name: 'Event', model: Event }
    ];

    // Rebuild indexes for each model
    for (const { name, model } of models) {
      try {
        console.log(`📊 Rebuilding indexes for ${name}...`);
        
        // Drop existing indexes (except _id)
        const existingIndexes = await model.collection.getIndexes();
        console.log(`   Found ${Object.keys(existingIndexes).length} existing indexes`);
        
        // Create/sync indexes from schema
        await model.syncIndexes();
        
        const newIndexes = await model.collection.getIndexes();
        console.log(`   ✅ ${name} indexes rebuilt: ${Object.keys(newIndexes).length} total`);
        console.log(`   Indexes: ${Object.keys(newIndexes).join(', ')}\n`);
        
      } catch (error) {
        console.error(`   ❌ Error rebuilding ${name} indexes:`, error.message);
      }
    }

    console.log('✨ Index rebuild complete!\n');
    
    // Display summary
    console.log('📋 Summary:');
    console.log('━'.repeat(50));
    for (const { name, model } of models) {
      const indexes = await model.collection.getIndexes();
      console.log(`${name}: ${Object.keys(indexes).length} indexes`);
      Object.keys(indexes).forEach(indexName => {
        if (indexName !== '_id_') {
          console.log(`  - ${indexName}`);
        }
      });
    }
    console.log('━'.repeat(50));

  } catch (error) {
    console.error('❌ Error during index rebuild:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
};

// Run the script
rebuildIndexes();
