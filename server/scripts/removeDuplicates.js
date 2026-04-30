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

// Remove duplicates
const removeDuplicates = async () => {
  try {
    console.log('🔍 Finding and removing duplicate members...\n');

    await connectDB();

    // Find all members
    const allMembers = await Member.find({}).sort({ createdAt: 1 });
    
    const seenEmails = new Map();
    const duplicates = [];

    // Identify duplicates (keep the oldest one)
    for (const member of allMembers) {
      if (seenEmails.has(member.email)) {
        duplicates.push(member);
      } else {
        seenEmails.set(member.email, member);
      }
    }

    console.log(`📊 Found ${duplicates.length} duplicate members\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      process.exit(0);
    }

    // Delete duplicate members and their user accounts
    for (const duplicate of duplicates) {
      console.log(`🗑️  Removing duplicate: ${duplicate.memberName} (${duplicate.email})`);
      console.log(`   Member ID: ${duplicate.memberId}`);
      
      // Delete member
      await Member.deleteOne({ _id: duplicate._id });
      
      // Delete associated user account
      await User.deleteOne({ memberId: duplicate.memberId });
    }

    console.log(`\n✅ Removed ${duplicates.length} duplicate members!`);
    console.log(`   Kept ${seenEmails.size} unique members\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
    process.exit(1);
  }
};

// Run the removal
removeDuplicates();
