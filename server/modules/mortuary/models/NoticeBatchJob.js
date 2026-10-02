const mongoose = require('mongoose');

// Tracks a background "generate every member's balance notice at one
// threshold level as a single PDF" run — mirrors the shape of
// server/shared/models/ImportOperation.js (the existing async-job pattern
// in this codebase), scoped down to what a PDF-generation job needs.
const noticeBatchJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      unique: true,
      required: true,
    },
    level: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    totalMembers: {
      type: Number,
      default: 0,
    },
    fileName: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    createdBy: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NoticeBatchJob', noticeBatchJobSchema);
