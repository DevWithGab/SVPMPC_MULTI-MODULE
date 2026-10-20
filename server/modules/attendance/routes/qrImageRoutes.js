const express = require('express');
const { Member } = require('../../../shared/models');
const { renderQRCodePng } = require('../services/qrCodeService');

const router = express.Router();

// Preserve the existing public image URLs used by previews, printing, and
// downloads, but rebuild their bytes from MongoDB instead of local files.
// Only the member's current issued UUID can resolve; old/replaced cards
// and guessed filenames must not expose a freshly issued code.
router.get('/:filename', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const { filename } = req.params;
  const match = /^[^/\\]+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.png$/.exec(filename);
  if (!match) return res.status(404).json({ message: 'QR image not found' });

  try {
    const member = await Member.findOne({ qrCode: match[1], qrCodeGenerated: true })
      .select('memberId memberName barangay qrCode').lean();
    if (!member || filename !== `${member.memberId}_${member.qrCode}.png`) {
      return res.status(404).json({ message: 'QR image not found' });
    }
    const png = await renderQRCodePng(member);
    return res.type('png').send(png);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
