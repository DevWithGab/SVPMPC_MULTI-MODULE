const csv = require('csv-parser');
const fs = require('fs');

/* Sumusunod sa row cap na ginagamit ng mortuary module's bulk-upload importers
(payments, beneficiaries, ledger entries) - ito lang yung bulk-upload path dati
sa app na walang cap, kaya kung oversized yung CSV, tatakbo yung per-row
validation sa baba, pati member creation, kung ilang rows man meron sa file. */
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
