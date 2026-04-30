const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { User, Member } = require('../shared/models');

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

// Delete mock members
const deleteMockMembers = async () => {
  try {
    console.log('🗑️  Deleting mock members...\n');

    await connectDB();

    const mockMemberIds = ['MEM-2024-001', 'MEM-2024-002', 'MEM-2024-003'];
    const mockUserIds = ['USER-MEM-001', 'USER-MEM-002', 'USER-MEM-003'];

    // Delete members
    const memberResult = await Member.deleteMany({ memberId: { $in: mockMemberIds } });
    console.log(`✅ Deleted ${memberResult.deletedCount} mock members`);

    // Delete users
    const userResult = await User.deleteMany({ userId: { $in: mockUserIds } });
    console.log(`✅ Deleted ${userResult.deletedCount} mock user accounts`);

    console.log('\n✅ Mock members removed successfully!');
    console.log('   Use CSV upload in SuperAdmin portal to add real members\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting mock members:', error);
    process.exit(1);
  }
};

// Run the deletion
deleteMockMembers();
