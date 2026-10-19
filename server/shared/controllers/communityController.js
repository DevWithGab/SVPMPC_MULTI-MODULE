const Member = require('../models/Member');

const CACHE_MS = 60 * 1000;
let cached;
let pending;

// Public branding needs only the shared registered-member total. Never load
// member documents or accept client-supplied filters on this endpoint.
const getCommunityStats = async (req, res) => {
  try {
    if (!cached || cached.expiresAt <= Date.now()) {
      if (!pending) {
        pending = Member.countDocuments({}).hint('_id_').maxTimeMS(3000)
          .then(totalMembers => { cached = { totalMembers, expiresAt: Date.now() + CACHE_MS }; })
          .finally(() => { pending = undefined; });
      }
      await pending;
    }
    res.set('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ totalMembers: cached.totalMembers });
  } catch {
    res.set('Cache-Control', 'no-store');
    return res.status(503).json({ message: 'Community statistics are temporarily unavailable.' });
  }
};

module.exports = { getCommunityStats };
