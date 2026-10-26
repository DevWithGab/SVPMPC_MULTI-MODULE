/* Shared "board-approval-style" supersede-then-insert pattern na ginagamit ng
bawat Admin-configurable setting na nag-keep ng full history (DeductionSetting,
NoticeThresholdSetting): isa lang palagi ang 'active' na row
(enforced by each model's own partial unique index on {status:'active'}), at
hindi nag-overwrite yung updating - sine-supersede niya yung current active
row at nag-insert ng bagong isa, kaya yung mga past claims/notices palaging
reresolve sa kung ano talaga yung in force noong nangyari ang mga iyon.

Dalawang separate documents yung pag-supersede ng old row at pag-insert ng
new one, kaya hindi puwedeng isang atomic operation lang ito kung walang
multi-document transaction (hindi available sa standalone MongoDB na walang
replica set). Dahil dito, puwedeng dalawang concurrent updates ang
magbasa ng parehong still-active row bago pa man ito ma-supersede ng isa sa
kanila; pinipigilan naman ng unique index na dalawa silang parehong
maging active, pero kung walang retry, ang insert ng natalo crashes nang
raw E11000 imbes na tahimik na sumunod lang sa kung sino ang nanalo - na-confirm
ito live: 6 concurrent updates, 5 successes at 1 raw 500, sa race na ang
outcome purely depende sa timing. */
const MAX_RACE_RETRIES = 10;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Dapat palagi FRESH at unsaved Mongoose document ang ibabalik ng
buildNewDoc() sa bawat tawag - tinatawag ulit ito sa bawat retry para laging
may sarili itong settingId/effectiveDate imbes na gamitin ulit yung galing
sa failed attempt. */
async function supersedeAndInsert(Model, buildNewDoc, { validateModifiedOnly = false, preserveFields = [] } = {}) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt++) {
    /* Maliit na, lumalaking random delay bago ang bawat retry (hindi sa unang
    attempt) - yung mga requests na natalo sa parehong round madalas
    magretry nang near lockstep, kaya mauulit lang ulit yung parehong
    collision; ang jitter nagpapakalat sa kanila para hindi na sila
    magbanggaan ulit. */
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
      /* May ibang update na nanalo sa round na ito - loop ulit at mag-retry
      base sa kung ano man ang active ngayon. */
    }
  }
  throw lastError;
}

module.exports = { supersedeAndInsert };
