const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { Member } = require('../shared/models');

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

// Check members
const checkMembers = async () => {
  try {
    console.log('🔍 Checking members in database...\n');

    await connectDB();

    const members = await Member.find({}).sort({ createdAt: -1 }).limit(20);
    
    console.log(`📊 Total members found: ${members.length}\n`);
    
    if (members.length === 0) {
      console.log('⚠️  No members found in database!');
      console.log('   Upload CSV in SuperAdmin portal to add members\n');
    } else {
      console.log('👥 Recent members:');
      members.forEach((member, index) => {
        console.log(`\n${index + 1}. ${member.memberName}`);
        console.log(`   ID: ${member.memberId}`);
        console.log(`   Email: ${member.email}`);
        console.log(`   Phone: ${member.phoneNumber}`);
        console.log(`   Status: ${member.status}`);
      });
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking members:', error);
    process.exit(1);
  }
};

// Run the check
checkMembers();
