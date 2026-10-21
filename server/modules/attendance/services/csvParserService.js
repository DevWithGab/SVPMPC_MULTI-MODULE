const csv = require('csv-parser');
const fs = require('fs');

// Matches the row cap used by the mortuary module's bulk-upload importers
// (payments, beneficiaries, ledger entries) — this was the one bulk-upload
// path in the app with no cap at all, so an oversized CSV ran the per-row
// validation below, and then member creation, over however many rows were
// in the file.
const MAX_ROWS = 1000;

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const validateMemberData = (members) => {
  const requiredFields = ['memberId', 'memberName', 'barangay', 'address'];
  const errors = [];

  if (members.length > MAX_ROWS) {
    return { isValid: false, errors: [`Maximum ${MAX_ROWS} members per upload.`] };
  }

  members.forEach((member, index) => {
    requiredFields.forEach((field) => {
      if (!member[field] || member[field].trim() === '') {
        errors.push(`Row ${index + 1}: Missing or empty field "${field}"`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

module.exports = {
  parseCSV,
  validateMemberData,
  MAX_ROWS,
};
