// Shared "board-approval-style" supersede-then-insert pattern used by every
// Admin-configurable setting that keeps full history (DeductionSetting,
// BenefitCapSetting, NoticeThresholdSetting): at most one row is ever
// 'active' (enforced by each model's own partial unique index on
// {status:'active'}), and updating never overwrites — it supersedes the
// current active row and inserts a brand new one, so past claims/notices
// always resolve to whatever was in force when they happened.
//
// Superseding the old row and inserting the new one are two separate
// documents, so they can't be one atomic operation without a multi-document
// transaction (not available on a standalone MongoDB with no replica set).
// Two concurrent updates can therefore both read the same still-active row
// before either supersedes it; the unique index stops both ending up
// active, but without retrying, the loser's insert crashes with a raw
// E11000 instead of quietly settling behind whichever request won — this
// was confirmed live: 6 concurrent updates produced 5 successes and 1 raw
// 500, in a race whose outcome depends purely on timing.
const MAX_RACE_RETRIES = 10;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// buildNewDoc() must return a FRESH, unsaved Mongoose document each call —
// it is invoked again on every retry so the new document always gets its
// own settingId/effectiveDate rather than reusing one from a failed attempt.
async function supersedeAndInsert(Model, buildNewDoc, { validateModifiedOnly = false, preserveFields = [] } = {}) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt++) {
    // A tiny, growing random delay before each retry (not the first
    // attempt) — several requests that lost the same round tend to retry
    // in near lockstep, which just reproduces the same collision again;
    // jitter spreads them out so they stop colliding with each other.
    if (attempt > 0) await sleep(Math.random() * attempt * 15);

    const newDoc = buildNewDoc();
    try {
      const currentActive = await Model.findOne({ status: 'active' });
      if (currentActive) {
        for (const field of preserveFields) {
          if (newDoc[field] === undefined) newDoc[field] = currentActive[field];
        }
        currentActive.status = 'superseded';
        currentActive.supersededBy = newDoc.settingId;
        currentActive.supersededAt = new Date();
        await currentActive.save(validateModifiedOnly ? { validateModifiedOnly: true } : undefined);
      }
      await newDoc.save();
      return newDoc;
    } catch (error) {
      lastError = error;
      if (error.code !== 11000) throw error;
      // Someone else's update won this round — loop and retry against
      // whatever is active now.
    }
  }
  throw lastError;
}

module.exports = { supersedeAndInsert };
