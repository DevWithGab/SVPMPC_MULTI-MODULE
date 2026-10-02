const path = require('path');
const { v4: uuidv4 } = require('uuid');
const NoticeBatchJob = require('../models/NoticeBatchJob');
const NoticeThresholdSetting = require('../models/NoticeThresholdSetting');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { generateNoticeBatchPdf, NOTICE_LEVEL_LABELS, DEFAULT_NOTICE_THRESHOLDS } = require('../services/noticeLetterPdfService');

const BATCH_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'notice-batches');

// Fire-and-forget worker — same shape as bulkImportService.processBulkImport,
// called from startNoticeBatch without awaiting it so the HTTP request can
// return immediately (202) instead of holding the connection open for
// however long generation takes.
const runNoticeBatchJob = async (jobId, level, managerName) => {
  const job = await NoticeBatchJob.findOne({ jobId });
  if (!job) return;

  try {
    const [{ members }, thresholds] = await Promise.all([
      getMemberBalanceSnapshots(),
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

    const jobId = uuidv4();
    await NoticeBatchJob.create({
      jobId,
      level,
      status: 'processing',
      createdBy: req.user?.username || req.user?.name || 'treasurer',
    });

    // Not awaited on purpose — see runNoticeBatchJob's comment.
    runNoticeBatchJob(jobId, level, req.user?.name || req.user?.username);

    res.status(202).json({
      success: true,
      message: `Generating ${NOTICE_LEVEL_LABELS[level]} letters in the background`,
      jobId,
      status: 'processing',
    });
  } catch (error) {
    console.error('Error starting notice batch:', error);
    res.status(500).json({ success: false, message: 'Error starting notice batch', error: error.message });
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
      status: job.status,
      totalMembers: job.totalMembers,
      error: job.error || undefined,
      downloadUrl: job.status === 'completed' ? `/uploads/notice-batches/${job.fileName}` : undefined,
    });
  } catch (error) {
    console.error('Error fetching notice batch status:', error);
    res.status(500).json({ success: false, message: 'Error fetching notice batch status', error: error.message });
  }
};

module.exports = {
  startNoticeBatch,
  getNoticeBatchStatus,
};
