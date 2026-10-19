const mongoose = require('mongoose');
const { ensureRateLimitIndexes } = require('../middleware/mongoRateLimitStore');
require('dotenv').config();

const connectDB = async () => {
  // Fail loudly here instead of silently connecting to a guessed local
  // default — an unset MONGODB_URI used to fall back to
  // mongodb://localhost:27017/..., which just produces a confusing
  // ECONNREFUSED later (or worse, silently connects to the wrong local
  // database) instead of pointing straight at the actual problem.
  if (!process.env.MONGODB_URI) {
    console.error('✗ MONGODB_URI is not set. Copy .env.example to .env and set it to your MongoDB connection string before starting the server.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await ensureRateLimitIndexes();

    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
