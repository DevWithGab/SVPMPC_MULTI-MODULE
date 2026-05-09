const { User, Member, ImportOperation, CredentialLog } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { sendCredentialEmail, sendCredentialSMS } = require('./credentialNotificationService');

// Generate temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Generate username from member name
const generateUsername = (memberName, memberId) => {
  const namePart = memberName
    .toLowerCase()
    .replace(/\s+/g, '.')
    .substring(0, 15);
  return `${namePart}.${memberId}`;
};

// Check for duplicates
const checkDuplicates = async (memberId, email, phoneNumber) => {
  const duplicates = {
    memberId: await Member.findOne({ memberId }),
    email: await Member.findOne({ email }),
    phoneNumber: await Member.findOne({ phoneNumber }),
  };

  return duplicates;
};

// Process single row
const processRow = async (rowData, rowNumber, operationId) => {
  const result = {
    rowNumber,
    memberId: rowData.memberId,
    status: 'pending',
    error: null,
    user: null,
    credentialsSentVia: [],
  };

  try {
    // Check for duplicates
    const duplicates = await checkDuplicates(
      rowData.memberId,
      rowData.email,
      rowData.phoneNumber
    );

    if (duplicates.memberId || duplicates.email || duplicates.phoneNumber) {
      result.status = 'duplicate';
      result.error = 'Member already exists (duplicate ID, email, or phone)';
      return result;
    }

    // Create Member
    const member = new Member({
      memberId: rowData.memberId,
      memberName: rowData.memberName,
      email: rowData.email,
      phoneNumber: rowData.phoneNumber,
      barangay: rowData.barangay,
      address: rowData.address,
    });

    await member.save();

    // Generate credentials
    const tempPassword = generateTempPassword();
    const username = generateUsername(rowData.memberName, rowData.memberId);

    // Create User
    const user = new User({
      userId: uuidv4(),
      memberId: rowData.memberId,
      username,
      email: rowData.email,
      phoneNumber: rowData.phoneNumber,
      passwordHash: tempPassword,
      isTemporaryPassword: true,
      status: 'active',
    });

    await user.save();

    result.user = {
      userId: user.userId,
      memberId: user.memberId,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      tempPassword: tempPassword,
    };

    // Send credentials
    const sendVia = rowData.sendVia || ['email', 'sms'];

    if (sendVia.includes('email')) {
      const emailResult = await sendCredentialEmail(
        rowData.email,
        rowData.memberName,
        username,
        tempPassword
      );

      if (emailResult.success) {
        result.credentialsSentVia.push('email');
      }
    }

    if (sendVia.includes('sms')) {
      const smsResult = await sendCredentialSMS(
        rowData.phoneNumber,
        rowData.memberName,
        username,
        tempPassword
      );

      if (smsResult.success) {
        result.credentialsSentVia.push('sms');
      }
    }

    // Log credential generation
    const credentialLog = new CredentialLog({
      logId: uuidv4(),
      userId: user.userId,
      memberId: rowData.memberId,
      action: 'generated',
      sentMethod: result.credentialsSentVia,
      status: result.credentialsSentVia.length > 0 ? 'success' : 'failed',
      operationId: operationId,
      attemptNumber: 1,
    });

    await credentialLog.save();

    result.status = 'success';
  } catch (error) {
    result.status = 'error';
    result.error = error.message;
  }

  return result;
};

// Process bulk import
const processBulkImport = async (operationId, rowsData, createdBy) => {
  try {
    const operation = await ImportOperation.findOne({ operationId });
    if (!operation) {
      throw new Error('Import operation not found');
    }

    operation.status = 'processing';
    operation.startedAt = new Date();
    operation.totalRows = rowsData.length;
    await operation.save();

    const results = {
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      emailsSent: 0,
      emailsFailed: 0,
      smsSent: 0,
      smsFailed: 0,
      createdUsers: [],
      rowErrors: [],
    };

    // Process each row
    for (let i = 0; i < rowsData.length; i++) {
      const rowResult = await processRow(rowsData[i], i + 2, operationId); // +2 because row 1 is header

      if (rowResult.status === 'success') {
        results.successCount++;
        results.createdUsers.push(rowResult.user);

        if (rowResult.credentialsSentVia.includes('email')) {
          results.emailsSent++;
        } else {
          results.emailsFailed++;
        }

        if (rowResult.credentialsSentVia.includes('sms')) {
          results.smsSent++;
        } else {
          results.smsFailed++;
        }
      } else if (rowResult.status === 'duplicate') {
        results.duplicateCount++;
        results.rowErrors.push({
          rowNumber: rowResult.rowNumber,
          memberId: rowResult.memberId,
          errorType: 'duplicate',
          errorMessage: rowResult.error,
        });
      } else {
        results.failureCount++;
        results.rowErrors.push({
          rowNumber: rowResult.rowNumber,
          memberId: rowResult.memberId,
          errorType: 'error',
          errorMessage: rowResult.error,
        });
      }
    }

    // Update operation with results
    operation.status = 'completed';
    operation.successCount = results.successCount;
    operation.failureCount = results.failureCount;
    operation.duplicateCount = results.duplicateCount;
    operation.emailsSent = results.emailsSent;
    operation.emailsFailed = results.emailsFailed;
    operation.smsSent = results.smsSent;
    operation.smsFailed = results.smsFailed;
    operation.createdUsers = results.createdUsers;
    operation.rowErrors = results.rowErrors;
    operation.completedAt = new Date();

    await operation.save();

    return {
      operationId,
      status: 'completed',
      summary: {
        totalRows: operation.totalRows,
        successCount: results.successCount,
        failureCount: results.failureCount,
        duplicateCount: results.duplicateCount,
        emailsSent: results.emailsSent,
        emailsFailed: results.emailsFailed,
        smsSent: results.smsSent,
        smsFailed: results.smsFailed,
      },
      createdUsers: results.createdUsers,
      errors: results.rowErrors.length > 0 ? results.rowErrors : undefined,
    };
  } catch (error) {
    const operation = await ImportOperation.findOne({ operationId });
    if (operation) {
      operation.status = 'failed';
      operation.completedAt = new Date();
      await operation.save();
    }

    throw error;
  }
};

module.exports = {
  generateTempPassword,
  generateUsername,
  checkDuplicates,
  processRow,
  processBulkImport,
};
