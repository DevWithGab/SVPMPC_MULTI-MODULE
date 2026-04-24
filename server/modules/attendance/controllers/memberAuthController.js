const { Member } = require('../models');
const { generateQRCodeDataUrl } = require('../services/qrCodeService');

// Get member profile with QR code
const getMemberProfile = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Generate QR code data URL for display
    let qrCodeDataUrl = null;
    if (member.qrCodeGenerated) {
      const qrResult = await generateQRCodeDataUrl(member);
      if (qrResult.success) {
        qrCodeDataUrl = qrResult.dataUrl;
      }
    }

    res.status(200).json({
      memberId: member.memberId,
      memberName: member.memberName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      barangay: member.barangay,
      address: member.address,
      qrCodeUrl: member.qrCodeUrl,
      qrCodeDataUrl: qrCodeDataUrl,
      qrCodeGenerated: member.qrCodeGenerated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member profile', error: error.message });
  }
};

// Get member attendance history
const getMemberAttendanceHistory = async (req, res) => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const attendanceHistory = await require('../models/Attendance')
      .find({ memberId })
      .sort({ scanTime: -1 });

    res.status(200).json({
      memberId: member.memberId,
      memberName: member.memberName,
      totalAttendance: attendanceHistory.length,
      attendanceHistory: attendanceHistory.map((record) => ({
        attendanceId: record.attendanceId,
        eventName: record.eventName,
        barangay: record.barangay,
        scanTime: record.scanTime,
        status: record.status,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching attendance history',
      error: error.message,
    });
  }
};

module.exports = {
  getMemberProfile,
  getMemberAttendanceHistory,
};
