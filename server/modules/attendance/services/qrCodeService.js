const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const QR_OPTIONS = {
  errorCorrectionLevel: 'H',
  type: 'image/png',
  width: 300,
  margin: 1,
  color: { dark: '#000000', light: '#FFFFFF' },
};

const buildMemberQRCodePayload = (member, qrCodeId) => ({
  type: 'member',
  memberId: member.memberId,
  name: member.memberName,
  barangay: member.barangay || null,
  qrId: qrCodeId || member.qrCode || null,
});

// Render from the issued ID stored in MongoDB. Rebuilding a missing image
// must never issue a new ID, because that would invalidate printed cards.
const renderQRCodePng = (member, qrCodeId = member.qrCode) =>
  QRCode.toBuffer(JSON.stringify(buildMemberQRCodePayload(member, qrCodeId)), QR_OPTIONS);

const generateQRCode = async (member) => {
  try {
    const qrCodeId = uuidv4();
    const qrCodeFileName = `${member.memberId}_${qrCodeId}.png`;
    // Validate rendering before the controller saves issuance. The image is
    // served on demand; no persistent filesystem is required on Render.
    await renderQRCodePng(member, qrCodeId);

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
    const dataUrl = await QRCode.toDataURL(qrData, QR_OPTIONS);

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
  renderQRCodePng,
};
