const mongoose = require('mongoose');
const User = require('../shared/models/User');

// Read-only diagnostics. Verify actual passwords through the application's
// rate-limited login; this utility must never test defaults or reset an account.
async function checkSuperAdminAccount() {
  const user = await User.findOne({ username: 'superadmin', role: 'super_admin' })
    .select('username role status isTemporaryPassword -_id');
  if (!user) throw new Error('Super Admin account not found.');
  return { username: user.username, role: user.role, status: user.status,
    isTemporaryPassword: user.isTemporaryPassword };
}

async function run() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const account = await checkSuperAdminAccount();
    console.log('Username: ' + account.username);
    console.log('Status: ' + account.status);
    console.log('Password change required: ' + (account.isTemporaryPassword ? 'Yes' : 'No'));
    console.log('No account changes made. Use the application to test sign-in.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(() => {
    console.error('Account check failed. Verify the configured database and Super Admin account.');
    process.exitCode = 1;
  });
}

module.exports = { checkSuperAdminAccount, run };
