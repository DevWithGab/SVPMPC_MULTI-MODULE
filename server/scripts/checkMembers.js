const mongoose = require('mongoose');
const path = require('path');
const { Member } = require('../shared/models');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const checkMembers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all members
    const allMembers = await Member.find({});
    
    console.log(`📋 Total members in database: ${allMembers.length}\n`);
    
    if (allMembers.length === 0) {
      console.log('💡 Database is empty - no members found');
      process.exit(0);
    }
    
    // Group by status
    const byStatus = {};
    allMembers.forEach(member => {
      const status = member.status || 'undefined';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(member);
    });
    
    console.log('📊 Members by status:\n');
    Object.keys(byStatus).forEach(status => {
      console.log(`   ${status.toUpperCase()}: ${byStatus[status].length} members`);
      byStatus[status].forEach(member => {
        console.log(`      - ${member.memberName} (${member.memberId})`);
      });
      console.log('');
    });
    
    // Check for staff pattern
    const staffPattern = allMembers.filter(m => 
      m.memberId.match(/^(SUPER-ADMIN|ATT-|MORT-)/)
    );
    
    console.log(`🔧 Staff members (by ID pattern): ${staffPattern.length}`);
    console.log(`👥 Regular members: ${allMembers.length - staffPattern.length}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkMembers();
