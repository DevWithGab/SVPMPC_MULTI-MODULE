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
    // Financial writes rely on this unique index, so do not accept traffic
    // while Mongoose's asynchronous model index initialization is still running.
    const Ledger = require('../modules/mortuary/models/Ledger');
    const { POSTING_INDEX, POSTING_INDEX_OPTIONS, POSTING_HEAD_INDEX, POSTING_HEAD_INDEX_OPTIONS } = require('../modules/mortuary/services/ledgerPostingService');
    await Ledger.collection.createIndex(POSTING_INDEX, POSTING_INDEX_OPTIONS);
    await Ledger.collection.createIndex(POSTING_HEAD_INDEX, POSTING_HEAD_INDEX_OPTIONS);
    const Claim = require('../modules/mortuary/models/Claim');
    const { CLAIM_MEMBER_INDEX, CLAIM_MEMBER_INDEX_OPTIONS } = require('../modules/mortuary/utils/claimEligibility');
    // Historical duplicates need review; never silently pick a winning claim.
    await Claim.collection.createIndex(CLAIM_MEMBER_INDEX, CLAIM_MEMBER_INDEX_OPTIONS);
    await ensureRateLimitIndexes();

    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
