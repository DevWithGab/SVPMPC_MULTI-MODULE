const { Member, ImportOperation } = require('../models');
// Check for duplicates
const checkDuplicates = async (memberId, email, phoneNumber) => {
  const duplicates = {
    memberId: await Member.findOne({ memberId }),
    email: email ? await Member.findOne({ email }) : null,
    phoneNumber: phoneNumber ? await Member.findOne({ phoneNumber }) : null,
  };

  return duplicates;
};

// Process single row
const processRow = async (rowData, rowNumber) => {
  const result = {
    rowNumber,
    memberId: rowData.memberId,
    status: 'pending',
    error: null,
    member: null,
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

    result.member = { memberId: member.memberId, memberName: member.memberName, email: member.email, phoneNumber: member.phoneNumber };
    result.status = 'success';
  } catch (error) {
    result.status = 'error';
    result.error = error.message;
  }

  return result;
};

// Process bulk import
const processBulkImport = async (operationId, rowsData) => {
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
      createdMembers: [],
      rowErrors: [],
    };

    // Process each row
    for (let i = 0; i < rowsData.length; i++) {
      const rowResult = await processRow(rowsData[i], i + 2); // +2 because row 1 is header

      if (rowResult.status === 'success') {
        results.successCount++;
        results.createdMembers.push(rowResult.member);

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
    operation.createdMembers = results.createdMembers;
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
      },
      createdMembers: results.createdMembers,
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
  checkDuplicates,
  processRow,
  processBulkImport,
};
