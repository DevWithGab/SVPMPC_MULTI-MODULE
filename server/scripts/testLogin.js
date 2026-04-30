const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../shared/models/User');

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

// Test login
const testLogin = async () => {
  try {
    console.log('🔍 Testing super admin login...\n');

    await connectDB();

    // Find super admin user
    const user = await User.findOne({ username: 'superadmin' });
    
    if (!user) {
      console.error('❌ Super admin user not found!');
      process.exit(1);
    }

    console.log('✅ Found super admin user');
    console.log(`   User ID: ${user.userId}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Password Hash: ${user.passwordHash.substring(0, 30)}...`);
    console.log(`   Hash Length: ${user.passwordHash.length}\n`);

    // Test password
    const testPassword = 'SuperAdmin2024!';
    console.log(`🔐 Testing password: ${testPassword}`);
    
    const isMatch = await user.comparePassword(testPassword);
    console.log(`   Result: ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}\n`);

    if (!isMatch) {
      console.log('🔄 Attempting to reset password...\n');
      
      // Reset password
      user.passwordHash = testPassword;
      await user.save();
      
      console.log('✅ Password reset complete!');
      console.log('   Testing again...\n');
      
      // Test again
      const userAfterReset = await User.findOne({ username: 'superadmin' });
      const isMatchAfterReset = await userAfterReset.comparePassword(testPassword);
      console.log(`   Result: ${isMatchAfterReset ? '✅ MATCH' : '❌ NO MATCH'}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 CREDENTIALS:');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin2024!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing login:', error);
    process.exit(1);
  }
};

// Run the test
testLogin();
