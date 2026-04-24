const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const { User, Member } = require('../shared/models');

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
    memberId: 'SUPER-ADMIN-MEM',
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
    memberId: 'ATT-ADMIN-MEM',
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
    memberId: 'ATT-SEC-MEM',
    username: 'attendance.secretary',
    email: 'attendance.secretary@svpmpc.com',
    phoneNumber: '09173333333',
    passwordHash: 'AttendanceSecretary2024!',
    isTemporaryPassword: false,
    status: 'active',
    modules: ['attendance'],
    role: 'secretary',
  },

  // Mortuary Module Staff
  mortuaryAdmin: {
    userId: 'MORT-ADMIN-001',
    memberId: 'MORT-ADMIN-MEM',
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
    memberId: 'MORT-TREAS-MEM',
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
    {
      memberId: 'MEM-2024-001',
      memberName: 'Juan Dela Cruz',
      email: 'juan.delacruz@example.com',
      phoneNumber: '09176666666',
      barangay: 'Barangay 1',
      address: '123 Main Street, City',
      beneficiaries: 'Maria Dela Cruz (Wife)',
      status: 'active',
      modules: ['attendance', 'mortuary'],
      userId: 'USER-MEM-001',
      username: 'juan.delacruz',
      password: 'Member2024!',
    },
    {
      memberId: 'MEM-2024-002',
      memberName: 'Maria Santos',
      email: 'maria.santos@example.com',
      phoneNumber: '09177777777',
      barangay: 'Barangay 2',
      address: '456 Oak Avenue, City',
      beneficiaries: 'Pedro Santos (Husband)',
      status: 'active',
      modules: ['attendance', 'mortuary'],
      userId: 'USER-MEM-002',
      username: 'maria.santos',
      password: 'Member2024!',
    },
    {
      memberId: 'MEM-2024-003',
      memberName: 'Pedro Garcia',
      email: 'pedro.garcia@example.com',
      phoneNumber: '09178888888',
      barangay: 'Barangay 3',
      address: '789 Pine Road, City',
      beneficiaries: 'Ana Garcia (Wife)',
      status: 'active',
      modules: ['attendance', 'mortuary'],
      userId: 'USER-MEM-003',
      username: 'pedro.garcia',
      password: 'Member2024!',
    },
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
  for (const memberData of seedData.sampleMembers) {
    const existingMember = await Member.findOne({ memberId: memberData.memberId });
    if (!existingMember) {
      const member = new Member({
        memberId: memberData.memberId,
        memberName: memberData.memberName,
        email: memberData.email,
        phoneNumber: memberData.phoneNumber,
        barangay: memberData.barangay,
        address: memberData.address,
        beneficiaries: memberData.beneficiaries,
        status: memberData.status,
        modules: memberData.modules,
      });
      await member.save();
      console.log(`✅ Created sample member: ${memberData.memberName}`);

      // Create user account for member
      const existingUser = await User.findOne({ userId: memberData.userId });
      if (!existingUser) {
        const user = new User({
          userId: memberData.userId,
          memberId: memberData.memberId,
          username: memberData.username,
          email: memberData.email,
          phoneNumber: memberData.phoneNumber,
          passwordHash: memberData.password,
          isTemporaryPassword: true,
          status: 'active',
          modules: memberData.modules,
        });
        await user.save();
        console.log(`✅ Created user account: ${memberData.username}`);
      }
    } else {
      console.log(`⏭️  Sample member already exists: ${memberData.memberName}`);
    }
  }
};

// Create admin users
const createAdminUsers = async () => {
  const adminUsers = [
    seedData.superAdmin,
    seedData.attendanceAdmin,
    seedData.attendanceSecretary,
    seedData.mortuaryAdmin,
    seedData.mortuaryTreasurer,
  ];

  for (const userData of adminUsers) {
    const existingUser = await User.findOne({ userId: userData.userId });
    if (!existingUser) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created admin user: ${userData.username}`);
    } else {
      console.log(`⏭️  Admin user already exists: ${userData.username}`);
    }
  }
};

// Main seed function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to database
    await connectDB();

    // Create staff members first
    console.log('\n📋 Creating staff member records...');
    await createStaffMembers();

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
    console.log('   - Password: AttendanceSecretary2024!\n');

    console.log('💰 MORTUARY MODULE:');
    console.log('   Admin:');
    console.log('   - Username: mortuary.admin');
    console.log('   - Password: MortuaryAdmin2024!');
    console.log('   Treasurer:');
    console.log('   - Username: mortuary.treasurer');
    console.log('   - Password: MortuaryTreasurer2024!\n');

    console.log('👥 SAMPLE MEMBERS:');
    console.log('   All members have password: Member2024!');
    console.log('   - juan.delacruz');
    console.log('   - maria.santos');
    console.log('   - pedro.garcia\n');

    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed
seedDatabase();
