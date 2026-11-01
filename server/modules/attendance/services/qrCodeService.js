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

/* Nire-render galing sa issued ID na naka-store sa MongoDB. Pag rebuild ng
missing image, bawal mag-issue ng bagong ID kasi mag-invalidate yun ng mga
printed cards. */
const renderQRCodePng = (member, qrCodeId = member.qrCode) =>
  QRCode.toBuffer(JSON.stringify(buildMemberQRCodePayload(member, qrCodeId)), QR_OPTIONS);

// Share the exact issued payload and error correction with the PNG renderer.
// Compact rows avoid PNG compression and browser image/canvas work for bulk cards.
const buildQRCodeMatrix = (member, qrCodeId = member.qrCode) => {
  const { modules } = QRCode.create(JSON.stringify(buildMemberQRCodePayload(member, qrCodeId)), QR_OPTIONS);
  return Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => modules.get(row, col) ? '1' : '0').join(''));
};

const generateQRCode = async (member) => {
  try {
    const qrCodeId = uuidv4();
    const qrCodeFileName = `${member.memberId}_${qrCodeId}.png`;
    // Validate QR capacity without rendering a PNG that would be discarded.
    QRCode.create(JSON.stringify(buildMemberQRCodePayload(member, qrCodeId)), QR_OPTIONS);

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
  buildQRCodeMatrix,
};
