const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const NoticeBatchJob = require('../models/NoticeBatchJob');
const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { generateNoticeBatchPdf, NOTICE_LEVEL_LABELS, DEFAULT_NOTICE_THRESHOLDS } = require('../services/noticeLetterPdfService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const { actorName } = require('../../../shared/utils/actorName');

/* May member names at financial standing itong mga PDFs, at (di-tulad ng CSV imports)
permanenteng nananatili pagkatapos magenerate - kailangang hindi sila dumapo sa uploads/,
kasi static yung serve ni server.js dun walang auth. Kung may nalaman o naghula ng jobId,
puwede niyang i-download yun forever. Ang downloadNoticeBatch sa baba lang ang paraan
para mabalik basahin ang mga ito. */
const BATCH_DIR = path.join(__dirname, '..', '..', '..', 'tmp-uploads', 'notice-batches');
if (!fs.existsSync(BATCH_DIR)) {
  fs.mkdirSync(BATCH_DIR, { recursive: true });
}

/* Fire-and-forget worker ito - parehong shape ng bulkImportService.processBulkImport,
tinatawag galing sa startNoticeBatch na walang await para agad makabalik yung HTTP
request (202) imbes na manatiling bukas yung connection kung gaano man tagal ang
generation. */
const runNoticeBatchJob = async (jobId, level, managerName, barangay) => {
  const job = await NoticeBatchJob.findOne({ jobId });
  if (!job) return;

  try {
    const [{ members }, thresholds] = await Promise.all([
      getMemberBalanceSnapshots({ barangayFilter: barangay || '' }),
      NoticeThresholdSetting.findOne({ status: 'active' }).lean(),
    ]);

    const fileName = `${jobId}.pdf`;
    const outputPath = path.join(BATCH_DIR, fileName);
    const count = await generateNoticeBatchPdf(
      members,
      level,
      managerName,
      thresholds || DEFAULT_NOTICE_THRESHOLDS,
      outputPath
    );

    job.status = 'completed';
    job.totalMembers = count;
    job.fileName = fileName;
    job.completedAt = new Date();
    await job.save();
  } catch (error) {
    console.error(`Notice batch job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date();
    await job.save();
  }
};

/* Nagsisimula ito ng background job na gumagawa ng balance notice ng bawat active
member sa given level bilang isang combined PDF. Ginagamit ito para sa batches na
masyadong malaki para komportableng magenerate sa browser tab mismo ng Treasurer (tingnan
yung LARGE_BATCH_THRESHOLD sa MemberBalances.jsx) - yung small/medium batches ay
instant pa ring nagegenerate client-side at hindi na dumadaan sa endpoint na ito. */
const startNoticeBatch = async (req, res) => {
  try {
    const level = parseInt(req.params.level, 10);
    if (![1, 2, 3].includes(level)) {
      return res.status(400).json({ success: false, message: 'level must be 1, 2, or 3' });
    }
    const barangay = (req.body.barangay || '').trim() || undefined;

    const jobId = uuidv4();
    await NoticeBatchJob.create({
      jobId,
      level,
      barangay,
      status: 'processing',
      createdBy: actorName(req.user, 'treasurer'),
    });

    // Not awaited on purpose — see runNoticeBatchJob's comment.
    runNoticeBatchJob(jobId, level, actorName(req.user, ''), barangay);

    res.status(202).json({
      success: true,
      message: barangay
        ? `Generating ${NOTICE_LEVEL_LABELS[level]} letters for ${barangay} in the background`
        : `Generating ${NOTICE_LEVEL_LABELS[level]} letters in the background`,
      jobId,
      status: 'processing',
    });
  } catch (error) {
    console.error('Error starting notice batch:', error);
    res.status(500).json({ success: false, message: 'Error starting notice batch', error: safeErrorMessage(error) });
  }
};

const getNoticeBatchStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await NoticeBatchJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Notice batch job not found' });
    }

    res.status(200).json({
      success: true,
      jobId,
      level: job.level,
      barangay: job.barangay || undefined,
      status: job.status,
      totalMembers: job.totalMembers,
      error: job.error || undefined,
      /* Authenticated API route ito, hindi static file path - yung file mismo nakatira na sa
      labas ng uploads/ (tingnan yung BATCH_DIR sa taas) at babasahin lang muli sa pamamagitan
      ng downloadNoticeBatch, na dumaan na rin sa parehong auth/module middleware para
      marating ang request na ito. */
      downloadUrl: job.status === 'completed' ? `/mortuary/treasurer/notices/batch/${job.jobId}/download` : undefined,
    });
  } catch (error) {
    console.error('Error fetching notice batch status:', error);
    res.status(500).json({ success: false, message: 'Error fetching notice batch status', error: safeErrorMessage(error) });
  }
};

/* Nagstream ito ng PDF ng completed batch. Maaabot lang ito sa pamamagitan ng
treasurerRoutes.js, na nasa likod ng parehong authenticateToken/authorizeModule('mortuary')
middleware gaya ng ibang treasurer API (tingnan yung server.js) - ito yung gate na
pumalit sa lumang public /uploads/notice-batches/ static path. */
const downloadNoticeBatch = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await NoticeBatchJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Notice batch job not found' });
    }
    if (job.status !== 'completed' || !job.fileName) {
      return res.status(400).json({ success: false, message: `This batch is not ready to download (status: ${job.status})` });
    }

    const filePath = path.join(BATCH_DIR, job.fileName);
    res.download(filePath, job.fileName, (error) => {
      if (error && !res.headersSent) {
        console.error(`Error downloading notice batch ${jobId}:`, error);
        res.status(404).json({ success: false, message: 'The generated PDF could not be found. Please regenerate this batch.' });
      }
    });
  } catch (error) {
    console.error('Error downloading notice batch:', error);
    res.status(500).json({ success: false, message: 'Error downloading notice batch', error: safeErrorMessage(error) });
  }
};

module.exports = {
  startNoticeBatch,
  getNoticeBatchStatus,
  downloadNoticeBatch,
};
