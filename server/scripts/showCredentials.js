const mongoose = require('mongoose');
const { User } = require('../shared/models');

// Historical filename retained for compatibility. Lists account status only.
async function listAccounts() {
  const users = await User.find({}).select('username role status modules isTemporaryPassword -_id').sort({ createdAt: 1 });
  return users.map(user => ({ username: user.username, role: user.role, status: user.status,
    modules: user.modules, isTemporaryPassword: user.isTemporaryPassword }));
}

async function run() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.table(await listAccounts());
    console.log('Account status only. Passwords and password hashes are not displayed.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(() => {
    console.error('Account listing failed. Verify the configured database.');
    process.exitCode = 1;
  });
}

module.exports = { listAccounts, run };
