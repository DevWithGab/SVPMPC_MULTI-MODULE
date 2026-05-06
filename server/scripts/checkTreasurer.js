const mongoose = require('mongoose');
const path = require('path');
const { User, Member } = require('../shared/models');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const checkTreasurer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find treasurer user
    const treasurer = await User.findOne({ role: 'treasurer' });
    
    if (!treasurer) {
      console.log('❌ No treasurer account found!');
      console.log('💡 Run: node server/scripts/seedUsers.js');
      process.exit(1);
    }

    console.log('✅ Treasurer account found!\n');
    console.log('📋 User Details:');
    console.log('   User ID:', treasurer.userId);
    console.log('   Member ID:', treasurer.memberId);
    console.log('   Username:', treasurer.username);
    console.log('   Email:', treasurer.email);
    console.log('   Phone:', treasurer.phoneNumber);
    console.log('   Role:', treasurer.role);
    console.log('   Status:', treasurer.status);
    console.log('   Modules:', treasurer.modules.join(', '));
    console.log('   Temporary Password:', treasurer.isTemporaryPassword);

    // Find corresponding member
    const member = await Member.findOne({ memberId: treasurer.memberId });
    if (member) {
      console.log('\n✅ Corresponding member found!');
      console.log('   Member Name:', member.memberName);
      console.log('   Barangay:', member.barangay);
      console.log('   Status:', member.status);
    } else {
      console.log('\n⚠️  No corresponding member record found');
    }

    console.log('\n🔑 Login Credentials:');
    console.log('   Username:', treasurer.username);
    console.log('   Password: MortuaryTreasurer2024!');
    console.log('\n✅ Ready to login to Treasurer Portal!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkTreasurer();
