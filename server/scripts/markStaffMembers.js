const mongoose = require('mongoose');
const path = require('path');
const { Member } = require('../shared/models');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const markStaffMembers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all staff members
    const staffMembers = await Member.find({
      memberId: { $regex: /^(SUPER-ADMIN|ATT-|MORT-)/ }
    });
    
    console.log(`📋 Found ${staffMembers.length} staff members:\n`);
    staffMembers.forEach(member => {
      console.log(`   - ${member.memberName} (${member.memberId}) - Current status: ${member.status}`);
    });
    
    // Update staff members to have 'staff' status instead of 'active'
    const result = await Member.updateMany(
      { memberId: { $regex: /^(SUPER-ADMIN|ATT-|MORT-)/ } },
      { $set: { status: 'staff' } }
    );
    
    console.log(`\n✅ Updated ${result.modifiedCount} staff members to status: 'staff'`);
    console.log('\n💡 Staff members will no longer appear in member ledger list');
    console.log('💡 Only regular members (uploaded via SuperAdmin) will show');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

markStaffMembers();
