const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const { User } = require('../shared/models');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/svpmpc-multi-module');
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed data
const seedData = {
  // Super Admin (not a member, just admin access)
  superAdmin: {
    userId: 'SUPER-ADMIN-001',
    staffId: 'STAFF-SUPER-001',
    username: 'superadmin',
    email: 'superadmin@svpmpc.com',
    phoneNumber: '09171111111',
    passwordHash: 'SuperAdmin2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['attendance', 'mortuary'],
    role: 'super_admin',
  },

  // Attendance Module Staff
  attendanceAdmin: {
    userId: 'ATT-ADMIN-001',
    staffId: 'STAFF-ATT-001',
    username: 'attendance.admin',
    email: 'attendance.admin@svpmpc.com',
    phoneNumber: '09172222222',
    passwordHash: 'AttendanceAdmin2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['attendance'],
    role: 'admin',
  },

  attendanceSecretary: {
    userId: 'ATT-SEC-001',
    staffId: 'STAFF-ATT-002',
    username: 'attendance.secretary',
    email: 'attendance.secretary@svpmpc.com',
    phoneNumber: '09173333333',
    passwordHash: 'AttendanceSecretary2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['attendance'],
    role: 'secretary',
  },

  attendanceOperator: {
    userId: 'ATT-OP-001',
    memberId: 'ATT-OP-MEM',
    username: 'attendance.scanner',
    email: 'attendance.scanner@svpmpc.com',
    phoneNumber: '09176666666',
    passwordHash: 'AttendanceOperator2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['attendance'],
    role: 'scanner_operator',
  },

  // Mortuary Module Staff
  mortuaryAdmin: {
    userId: 'MORT-ADMIN-001',
    staffId: 'STAFF-MORT-001',
    username: 'mortuary.admin',
    email: 'mortuary.admin@svpmpc.com',
    phoneNumber: '09174444444',
    passwordHash: 'MortuaryAdmin2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['mortuary'],
    role: 'admin',
  },

  mortuaryTreasurer: {
    userId: 'MORT-TREAS-001',
    staffId: 'STAFF-MORT-002',
    username: 'mortuary.treasurer',
    email: 'mortuary.treasurer@svpmpc.com',
    phoneNumber: '09175555555',
    passwordHash: 'MortuaryTreasurer2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['mortuary'],
    role: 'treasurer',
  },

  // Sample Members
  sampleMembers: [
    // Removed - use CSV upload instead
  ],
};

// Create Member records for staff (they need to be members too)
const createStaffMembers = async () => {
  const staffMembers = [
    {
      memberId: 'SUPER-ADMIN-MEM',
      memberName: 'Super Administrator',
      email: 'superadmin@svpmpc.com',
      phoneNumber: '09171111111',
      barangay: 'Admin Office',
      address: 'SVPMPC Main Office',
      status: 'active',
      modules: ['attendance', 'mortuary'],
    },
    {
      memberId: 'ATT-ADMIN-MEM',
      memberName: 'Attendance Administrator',
      email: 'attendance.admin@svpmpc.com',
      phoneNumber: '09172222222',
      barangay: 'Admin Office',
      address: 'SVPMPC Attendance Office',
      status: 'active',
      modules: ['attendance'],
    },
    {
      memberId: 'ATT-SEC-MEM',
      memberName: 'Attendance Secretary',
      email: 'attendance.secretary@svpmpc.com',
      phoneNumber: '09173333333',
      barangay: 'Admin Office',
      address: 'SVPMPC Attendance Office',
      status: 'active',
      modules: ['attendance'],
    },
    {
      memberId: 'ATT-OP-MEM',
      memberName: 'Attendance Operator',
      email: 'attendance.scanner@svpmpc.com',
      phoneNumber: '09176666666',
      barangay: 'Admin Office',
      address: 'SVPMPC Attendance Office',
      status: 'active',
      modules: ['attendance'],
    },
    {
      memberId: 'MORT-ADMIN-MEM',
      memberName: 'Mortuary Administrator',
      email: 'mortuary.admin@svpmpc.com',
      phoneNumber: '09174444444',
      barangay: 'Admin Office',
      address: 'SVPMPC Mortuary Office',
      status: 'active',
      modules: ['mortuary'],
    },
    {
      memberId: 'MORT-TREAS-MEM',
      memberName: 'Mortuary Treasurer',
      email: 'mortuary.treasurer@svpmpc.com',
      phoneNumber: '09175555555',
      barangay: 'Admin Office',
      address: 'SVPMPC Mortuary Office',
      status: 'active',
      modules: ['mortuary'],
    },
  ];

  for (const memberData of staffMembers) {
    const existingMember = await Member.findOne({ memberId: memberData.memberId });
    if (!existingMember) {
      const member = new Member(memberData);
      await member.save();
      console.log(`✅ Created staff member: ${memberData.memberName}`);
    } else {
      console.log(`⏭️  Staff member already exists: ${memberData.memberName}`);
    }
  }
};

// Create sample members
const createSampleMembers = async () => {
  // Skipped - use CSV upload instead
  console.log('⏭️  Skipping sample members - use CSV upload in SuperAdmin portal');
};

// Create admin users
const createAdminUsers = async () => {
  const adminUsers = [
    seedData.superAdmin,
    seedData.attendanceAdmin,
    seedData.attendanceSecretary,
    seedData.attendanceOperator,
    seedData.mortuaryAdmin,
    seedData.mortuaryTreasurer,
  ];

  for (const userData of adminUsers) {
    const existingUser = await User.findOne({
      $or: [
        { userId: userData.userId },
        { username: userData.username },
        { email: userData.email },
        { memberId: userData.memberId },
      ],
    });

    if (!existingUser) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created admin user: ${userData.username}`);
    } else {
      const passwordMatches = await existingUser.comparePassword(userData.passwordHash);
      let userUpdated = false;

      if (existingUser.staffId !== userData.staffId) {
        existingUser.staffId = userData.staffId;
        userUpdated = true;
      }

      if (!passwordMatches) {
        existingUser.passwordHash = userData.passwordHash;
        existingUser.isTemporaryPassword = false;
        userUpdated = true;
      }

      if (userUpdated) {
        await existingUser.save();
        console.log(`🔄 Repaired admin user: ${userData.username}`);
      } else {
        console.log(`⏭️  Admin user already exists: ${userData.username}`);
      }
    }
  }
};

// Main seed function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to database
    await connectDB();

    // Attempt to drop any legacy memberId index that can cause duplicate-null errors.
    try {
      const coll = mongoose.connection.collection('users');
      const indexes = await coll.indexes();
      if (indexes.some(ix => ix.name === 'memberId_1')) {
        await coll.dropIndex('memberId_1');
        console.log('🗑️ Dropped legacy index: memberId_1');
      }
    } catch (idxErr) {
      console.warn('⚠️  Could not drop legacy index (continuing):', idxErr.message);
    }

    // Create admin users
    console.log('\n👤 Creating admin user accounts...');
    await createAdminUsers();

    // Create sample members
    console.log('\n👥 Creating sample members...');
    await createSampleMembers();

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 CREDENTIALS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🔐 SUPER ADMIN:');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin2024!');
    console.log('   Access: All modules + Member Management\n');

    console.log('📊 ATTENDANCE MODULE:');
    console.log('   Admin:');
    console.log('   - Username: attendance.admin');
    console.log('   - Password: AttendanceAdmin2024!');
    console.log('   Secretary:');
    console.log('   - Username: attendance.secretary');
    console.log('   - Password: AttendanceSecretary2024!');
    console.log('   Scanner Operator:');
    console.log('   - Username: attendance.scanner');
    console.log('   - Password: AttendanceOperator2024!\n');

    console.log('💰 MORTUARY MODULE:');
    console.log('   Admin:');
    console.log('   - Username: mortuary.admin');
    console.log('   - Password: MortuaryAdmin2024!');
    console.log('   Treasurer:');
    console.log('   - Username: mortuary.treasurer');
    console.log('   - Password: MortuaryTreasurer2024!\n');

    console.log('👥 SAMPLE MEMBERS:');
    console.log('   Use CSV upload in SuperAdmin portal to add members\n');

    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed
seedDatabase();
