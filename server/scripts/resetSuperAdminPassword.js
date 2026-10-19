const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const User = require('../shared/models/User');

async function resetPassword() {
  const password = randomBytes(18).toString('base64url');
  // Query updates do not run the password-hashing save hook. Hash explicitly,
  // and increment the version atomically so concurrent resets each revoke sessions.
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { username: 'superadmin', role: 'super_admin' },
    { $set: { passwordHash, isTemporaryPassword: true, lastPasswordChangeDate: new Date() },
      $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true },
  );
  if (!user) throw new Error('Super Admin account not found.');
  return { username: user.username, password };
}

async function run() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured.');
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Run recovery in a private interactive terminal; passwords must not go to captured output.');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const credentials = await resetPassword();
    console.log('Super Admin password reset. All previous sessions are invalid.');
    console.log('Username: ' + credentials.username);
    console.log('Temporary password (shown once): ' + credentials.password);
    console.log('Keep this private. Sign in and change the temporary password.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(() => {
    console.error('Super Admin recovery failed. Verify the configured database and use a private interactive terminal.');
    process.exitCode = 1;
  });
}

module.exports = { resetPassword, run };
