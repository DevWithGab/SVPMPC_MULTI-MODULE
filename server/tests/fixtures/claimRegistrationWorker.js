const mongoose = require('mongoose');
const dbName = process.env.CLAIM_TEST_DATABASE;
if (!process.send || !/^svpmpc_claim_registration_test_[a-f0-9]+$/.test(dbName || '') || !process.env.TEST_MONGODB_URI) {
  throw new Error('This worker requires the isolated claim registration integration test.');
}
let begin;
const started = new Promise(resolve => { begin = resolve; });
process.on('message', message => { if (message === 'start') begin(); });
(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName, autoIndex: false, autoCreate: false });
  const Claim = require('../../modules/mortuary/models/Claim');
  const Member = require('../../shared/models/Member');
  const Beneficiary = require('../../modules/mortuary/models/Beneficiary');
  const AuditLog = require('../../shared/models/AuditLog');
  const mode = process.env.CLAIM_TEST_MODE;
  if (mode === 'crash-before-member') {
    Member.updateOne = async () => {
      process.send({ type: 'interrupted' });
      await new Promise(() => {});
    };
  }
  if (mode === 'crash-after-member') {
    Claim.findOneAndUpdate = async () => {
      process.send({ type: 'interrupted' });
      await new Promise(() => {});
    };
  }
  const { createClaimRegistrationService } = require('../../modules/mortuary/services/claimRegistrationService');
  const service = createClaimRegistrationService({ Claim, Member, Beneficiary, AuditLog });
  process.send({ type: 'ready' });
  await started;
  if (mode === 'recover') {
    await service.recover();
    process.send({ type: 'result', recovered: true });
  } else {
    try {
      const result = await service.register(JSON.parse(process.env.CLAIM_TEST_INPUT), {
        userId: 'TEST-OFFICER', userName: 'Integration Officer', userRole: 'claims_officer',
      });
      process.send({ type: 'result', created: result.created, claimId: result.claim.claimId });
    } catch (error) {
      if (!error.status) throw error;
      process.send({ type: 'result', status: error.status });
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await mongoose.disconnect();
  process.disconnect();
});
