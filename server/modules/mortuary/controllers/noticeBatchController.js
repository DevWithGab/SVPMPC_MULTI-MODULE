const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const NoticeBatchJob = require('../models/NoticeBatchJob');
const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { generateNoticeBatchPdf, NOTICE_LEVEL_LABELS, DEFAULT_NOTICE_THRESHOLDS } = require('../services/noticeLetterPdfService');
const { safeErrorMessage } = require('../../../middleware/errorHandler');

// These PDFs contain member names and financial standing, and (unlike the
// CSV imports) persist indefinitely once generated — they must never sit
// under uploads/, which server.js serves statically with no auth. Anyone who
// learned or guessed a jobId could otherwise download it forever.
// downloadNoticeBatch below is the only way to read these back out.
const BATCH_DIR = path.join(__dirname, '..', '..', '..', 'tmp-uploads', 'notice-batches');
if (!fs.existsSync(BATCH_DIR)) {
  fs.mkdirSync(BATCH_DIR, { recursive: true });
}

// Fire-and-forget worker — same shape as bulkImportService.processBulkImport,
// called from startNoticeBatch without awaiting it so the HTTP request can
// return immediately (202) instead of holding the connection open for
// however long generation takes.
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

// Starts a background job generating every active member's balance notice
// at the given level as one combined PDF. Used for batches too large to
// comfortably generate in the Treasurer's own browser tab (see
// LARGE_BATCH_THRESHOLD in MemberBalances.jsx) — small/medium batches are
// still generated instantly client-side and never hit this endpoint.
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
      createdBy: req.user?.username || req.user?.name || 'treasurer',
    });

    // Not awaited on purpose — see runNoticeBatchJob's comment.
    runNoticeBatchJob(jobId, level, req.user?.name || req.user?.username, barangay);

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
      // An authenticated API route, not a static file path — the file itself
      // lives outside uploads/ now (see BATCH_DIR above) and is only ever
      // read back through downloadNoticeBatch, which this request already
      // had to pass the same auth/module middleware to reach.
      downloadUrl: job.status === 'completed' ? `/mortuary/treasurer/notices/batch/${job.jobId}/download` : undefined,
    });
  } catch (error) {
    console.error('Error fetching notice batch status:', error);
    res.status(500).json({ success: false, message: 'Error fetching notice batch status', error: safeErrorMessage(error) });
  }
};

// Streams a completed batch's PDF. Reachable only through treasurerRoutes.js,
// which sits behind the same authenticateToken/authorizeModule('mortuary')
// middleware as the rest of the treasurer API (see server.js) — this is the
// gate that replaces the old public /uploads/notice-batches/ static path.
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
