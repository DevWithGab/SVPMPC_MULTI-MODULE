const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const QR_CODE_DIR = path.join(__dirname, '../../..', 'uploads', 'qrcodes');

// Ensure QR code directory exists
if (!fs.existsSync(QR_CODE_DIR)) {
  fs.mkdirSync(QR_CODE_DIR, { recursive: true });
}

const buildMemberQRCodePayload = (member, qrCodeId) => ({
  type: 'member',
  memberId: member.memberId,
  name: member.memberName,
  barangay: member.barangay || null,
  qrId: qrCodeId || member.qrCode || null,
});

const generateQRCode = async (member) => {
  try {
    const qrCodeId = uuidv4();
    const qrCodeFileName = `${member.memberId}_${qrCodeId}.png`;
    const qrCodePath = path.join(QR_CODE_DIR, qrCodeFileName);

    // Generate QR code payload with full member details
    const qrData = JSON.stringify(buildMemberQRCodePayload(member, qrCodeId));

    // Generate and save QR code image
    await QRCode.toFile(qrCodePath, qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Return QR code URL and ID
    const qrCodeUrl = `/uploads/qrcodes/${qrCodeFileName}`;

    return {
      qrCode: qrCodeId,
      qrCodeUrl: qrCodeUrl,
      success: true,
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const generateQRCodeDataUrl = async (member) => {
  try {
    const qrData = JSON.stringify(buildMemberQRCodePayload(member, member.qrCode));

    // Generate QR code as data URL (for display in browser)
    const dataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      dataUrl: dataUrl,
      success: true,
    };
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  generateQRCode,
  generateQRCodeDataUrl,
};
