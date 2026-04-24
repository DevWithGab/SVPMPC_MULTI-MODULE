const csv = require('csv-parser');
const fs = require('fs');

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
  const requiredFields = ['memberId', 'memberName', 'email', 'phoneNumber', 'barangay', 'address'];
  const errors = [];

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
};
