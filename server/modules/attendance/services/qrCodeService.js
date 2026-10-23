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

const generateQRCode = async (member) => {
  try {
    const qrCodeId = uuidv4();
    const qrCodeFileName = `${member.memberId}_${qrCodeId}.png`;
    /* Ginagamit para i-validate yung rendering bago i-save ng controller yung
    issuance. On-demand naman i-serve yung image, kaya walang kailangang
    persistent filesystem sa Render. */
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
