const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { User } = require('../shared/models');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/svpmpc-multi-module');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Show all credentials
const showCredentials = async () => {
  try {
    console.log('🔐 Fetching all user credentials...\n');

    await connectDB();

    const users = await User.find({}).sort({ createdAt: 1 });
    
    console.log(`📊 Total users: ${users.length}\n`);
    console.log('═══════════════════════════════════════════════════════════');
    
    for (const user of users) {
      console.log(`\n👤 ${user.username}`);
      console.log(`   Role: ${user.role || 'member'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Modules: ${user.modules.join(', ')}`);
      console.log(`   Temporary Password: ${user.isTemporaryPassword ? 'Yes' : 'No'}`);
      
      // Test password
      const testPassword = 'Member2024!';
      const isMatch = await user.comparePassword(testPassword);
      if (isMatch) {
        console.log(`   ✅ Password: Member2024!`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n� ADMIN ACCOUNTS:');
    console.log('   superadmin / SuperAdmin2024!');
    console.log('   attendance.admin / AttendanceAdmin2024!');
    console.log('   attendance.secretary / AttendanceSecretary2024!');
    console.log('   mortuary.admin / MortuaryAdmin2024!');
    console.log('   mortuary.treasurer / MortuaryTreasurer2024!');
    console.log('\n💡 Member accounts use their username and temporary password shown above\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run
showCredentials();
