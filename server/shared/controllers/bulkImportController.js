const ImportOperation = require('../models/ImportOperation');
const { parseCSV, validateMemberData } = require('../../modules/attendance/services/csvParserService');
const { processBulkImport } = require('../services/bulkImportService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Step 1: Upload and preview CSV
const uploadAndPreviewCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV
    const members = await parseCSV(req.file.path);

    // Validate data
    const validation = validateMemberData(members);
    if (!validation.isValid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: 'CSV validation failed',
        errors: validation.errors,
      });
    }

    // Create preview data
    const previewData = members.map((member, index) => ({
      rowNumber: index + 2,
      memberId: member.memberId,
      memberName: member.memberName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      barangay: member.barangay,
      address: member.address,
      validationStatus: 'valid',
      validationMessage: 'Ready to import',
    }));

    // Create ImportOperation in preview status
    const operationId = `IMPORT-${Date.now()}`;
    const importOp = new ImportOperation({
      operationId,
      fileName: req.file.originalname,
      status: 'preview',
      totalRows: members.length,
      previewData: previewData,
      createdBy: req.body.createdBy || 'admin',
    });

    await importOp.save();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: 'CSV preview ready',
      operationId,
      fileName: req.file.originalname,
      totalRows: members.length,
      previewData: previewData,
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing CSV', error: error.message });
  }
};

// Step 2: Confirm and start import
const confirmAndStartImport = async (req, res) => {
  try {
    const { operationId, sendVia } = req.body;

    if (!operationId) {
      return res.status(400).json({ message: 'Operation ID required' });
    }

    const importOp = await ImportOperation.findOne({ operationId });
    if (!importOp) {
      return res.status(404).json({ message: 'Import operation not found' });
    }

    if (importOp.status !== 'preview') {
      return res.status(400).json({ message: 'Operation is not in preview status' });
    }

    // Prepare row data with sendVia preference
    const rowsData = importOp.previewData.map((preview) => ({
      memberId: preview.memberId,
      memberName: preview.memberName,
      email: preview.email,
      phoneNumber: preview.phoneNumber,
      barangay: preview.barangay,
      address: preview.address,
      sendVia: sendVia || ['email', 'sms'],
    }));

    // Process bulk import (async)
    processBulkImport(operationId, rowsData, importOp.createdBy)
      .then(() => {
        console.log(`Import operation ${operationId} completed`);
      })
      .catch((error) => {
        console.error(`Import operation ${operationId} failed:`, error);
      });

    res.status(202).json({
      message: 'Import started processing',
      operationId,
      status: 'processing',
      note: 'Check status endpoint for progress',
    });
  } catch (error) {
    res.status(500).json({ message: 'Error starting import', error: error.message });
  }
};

// Step 3: Get import status
const getImportStatus = async (req, res) => {
  try {
    const { operationId } = req.params;

    const importOp = await ImportOperation.findOne({ operationId });
    if (!importOp) {
      return res.status(404).json({ message: 'Import operation not found' });
    }

    res.status(200).json({
      operationId,
      fileName: importOp.fileName,
      status: importOp.status,
      summary: {
        totalRows: importOp.totalRows,
        successCount: importOp.successCount,
        failureCount: importOp.failureCount,
        duplicateCount: importOp.duplicateCount,
        emailsSent: importOp.emailsSent,
        emailsFailed: importOp.emailsFailed,
        smsSent: importOp.smsSent,
        smsFailed: importOp.smsFailed,
      },
      createdUsers: importOp.createdUsers.length,
      errors: importOp.rowErrors.length,
      startedAt: importOp.startedAt,
      completedAt: importOp.completedAt,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching status', error: error.message });
  }
};

// Get import details
const getImportDetails = async (req, res) => {
  try {
    const { operationId } = req.params;

    const importOp = await ImportOperation.findOne({ operationId });
    if (!importOp) {
      return res.status(404).json({ message: 'Import operation not found' });
    }

    res.status(200).json(importOp);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching details', error: error.message });
  }
};

// Get all import operations
const getAllImportOperations = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const operations = await ImportOperation.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      count: operations.length,
      operations: operations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching operations', error: error.message });
  }
};

module.exports = {
  uploadAndPreviewCSV,
  confirmAndStartImport,
  getImportStatus,
  getImportDetails,
  getAllImportOperations,
};
