const mongoose = require('mongoose');
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

// Reset super admin password
const resetPassword = async () => {
  try {
    console.log('🔄 Resetting super admin password...\n');

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
    console.log(`   Role: ${user.role}\n`);

    // Set new password (will be hashed by pre-save hook)
    user.passwordHash = 'SuperAdmin2024!';
    user.isTemporaryPassword = false;
    user.lastPasswordChangeDate = new Date();
    
    await user.save();

    console.log('✅ Password reset successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 NEW CREDENTIALS:');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin2024!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  }
};

// Run the reset
resetPassword();
