const { Member } = require('../../../shared/models');
const { parseCSV, validateMemberData } = require('../services/csvParserService');
const { generateQRCode } = require('../services/qrCodeService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Upload members from CSV
const uploadMembers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse CSV file
    const members = await parseCSV(req.file.path);

    // Validate member data
    const validation = validateMemberData(members);
    if (!validation.isValid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: 'CSV validation failed',
        errors: validation.errors,
      });
    }

    // Save members to database
    const savedMembers = [];
    const errors = [];

    for (const memberData of members) {
      try {
        const newMember = new Member({
          memberId: memberData.memberId.trim(),
          memberName: memberData.memberName.trim(),
          email: memberData.email.trim(),
          phoneNumber: memberData.phoneNumber.trim(),
          barangay: memberData.barangay.trim(),
          address: memberData.address.trim(),
        });

        const saved = await newMember.save();
        savedMembers.push(saved);
      } catch (error) {
        errors.push({
          memberId: memberData.memberId,
          error: error.message,
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(201).json({
      message: 'Members uploaded successfully',
      savedCount: savedMembers.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      members: savedMembers,
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error uploading members', error: error.message });
  }
};

// Generate QR codes for members
const generateQRCodes = async (req, res) => {
  try {
    const { memberIds } = req.body;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'No member IDs provided' });
    }

    const members = await Member.find({ memberId: { $in: memberIds } });

    if (members.length === 0) {
      return res.status(404).json({ message: 'No members found' });
    }

    const results = [];
    const errors = [];

    for (const member of members) {
      try {
        const qrResult = await generateQRCode(member);

        if (qrResult.success) {
          member.qrCode = qrResult.qrCode;
          member.qrCodeUrl = qrResult.qrCodeUrl;
          member.qrCodeGenerated = true;
          await member.save();

          results.push({
            memberId: member.memberId,
            memberName: member.memberName,
            qrCodeUrl: member.qrCodeUrl,
          });
        } else {
          errors.push({
            memberId: member.memberId,
            error: qrResult.error,
          });
        }
      } catch (error) {
        errors.push({
          memberId: member.memberId,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      message: 'QR codes generated successfully',
      generatedCount: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating QR codes', error: error.message });
  }
};

// Generate QR codes for all members without QR codes
const generateAllQRCodes = async (req, res) => {
  try {
    const members = await Member.find({ qrCodeGenerated: false });

    if (members.length === 0) {
      return res.status(200).json({ message: 'All members already have QR codes' });
    }

    const results = [];
    const errors = [];

    for (const member of members) {
      try {
        const qrResult = await generateQRCode(member);

        if (qrResult.success) {
          member.qrCode = qrResult.qrCode;
          member.qrCodeUrl = qrResult.qrCodeUrl;
          member.qrCodeGenerated = true;
          await member.save();

          results.push({
            memberId: member.memberId,
            memberName: member.memberName,
            qrCodeUrl: member.qrCodeUrl,
          });
        } else {
          errors.push({
            memberId: member.memberId,
            error: qrResult.error,
          });
        }
      } catch (error) {
        errors.push({
          memberId: member.memberId,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      message: 'QR codes generated for all members',
      generatedCount: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating QR codes', error: error.message });
  }
};

// Get all members
const getAllMembers = async (req, res) => {
  try {
    const members = await Member.find();
    res.status(200).json({
      count: members.length,
      members: members,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members', error: error.message });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await Member.findOne({ memberId });

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    res.status(200).json(member);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member', error: error.message });
  }
};

module.exports = {
  uploadMembers,
  generateQRCodes,
  generateAllQRCodes,
  getAllMembers,
  getMemberById,
};
