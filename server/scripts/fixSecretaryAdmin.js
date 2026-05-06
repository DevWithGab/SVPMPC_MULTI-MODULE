const mongoose = require('mongoose');
const path = require('path');
const { Member } = require('../shared/models');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fixSecretaryAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Update Secretary Admin to staff status
    const result = await Member.updateOne(
      { memberId: 'SVMPC-SEC-001' },
      { $set: { status: 'staff' } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Secretary Admin status changed to "staff"');
    } else {
      console.log('💡 Secretary Admin not found or already has staff status');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

fixSecretaryAdmin();
