const mongoose = require('mongoose');
const { ensureRateLimitIndexes } = require('../middleware/mongoRateLimitStore');
require('dotenv').config();

const connectDB = async () => {
  /* Fail loudly dito instead na mag-connect ng tahimik sa guessed local
  default - dati kapag unset ang MONGODB_URI, babalik lang sa
  mongodb://localhost:27017/..., na magreresulta lang sa confusing
  ECONNREFUSED mamaya (o mas malala, tahimik na makaka-connect sa maling
  local database) imbes na direktang ituro ang totoong problema. */
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
