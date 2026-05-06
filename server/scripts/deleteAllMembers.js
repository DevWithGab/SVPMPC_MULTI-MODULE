const mongoose = require('mongoose');
const path = require('path');
const { Member, User } = require('../shared/models');
const Ledger = require('../modules/mortuary/models/Ledger');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const deleteAllMembers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all non-staff members (exclude staff by ID pattern)
    const regularMembers = await Member.find({
      $and: [
        { memberId: { $not: /^(SUPER-ADMIN|ATT-|MORT-|SVMPC-)/ } },
        { status: { $ne: 'staff' } }
      ]
    });
    
    console.log(`📋 Found ${regularMembers.length} regular members to delete:\n`);
    
    if (regularMembers.length === 0) {
      console.log('💡 No regular members found. Only staff members exist.');
      process.exit(0);
    }
    
    // Show all members to be deleted
    regularMembers.forEach(member => {
      console.log(`   - ${member.memberName} (${member.memberId})`);
    });
    
    console.log('\n⚠️  WARNING: This will delete:');
    console.log(`   - ${regularMembers.length} member records`);
    console.log(`   - Their user accounts`);
    console.log(`   - Their ledger entries`);
    console.log('\n💡 Staff members will NOT be deleted\n');
    
    // Delete members
    const memberResult = await Member.deleteMany({
      $and: [
        { memberId: { $not: /^(SUPER-ADMIN|ATT-|MORT-|SVMPC-)/ } },
        { status: { $ne: 'staff' } }
      ]
    });
    
    // Delete their user accounts
    const userResult = await User.deleteMany({
      $and: [
        { memberId: { $not: /^(SUPER-ADMIN|ATT-|MORT-|SVMPC-)/ } },
        { role: { $ne: 'super_admin' } },
        { role: { $ne: 'admin' } },
        { role: { $ne: 'treasurer' } },
        { role: { $ne: 'secretary' } }
      ]
    });
    
    // Delete their ledger entries
    const ledgerResult = await Ledger.deleteMany({
      memberId: { $not: /^(SUPER-ADMIN|ATT-|MORT-|SVMPC-)/ }
    });
    
    console.log('✅ Deletion complete!\n');
    console.log(`   Members deleted: ${memberResult.deletedCount}`);
    console.log(`   User accounts deleted: ${userResult.deletedCount}`);
    console.log(`   Ledger entries deleted: ${ledgerResult.deletedCount}`);
    console.log('\n💡 Staff members preserved. Database is clean and ready for new upload.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

deleteAllMembers();
