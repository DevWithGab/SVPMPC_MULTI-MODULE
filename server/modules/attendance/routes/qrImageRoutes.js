const express = require('express');
const { Member } = require('../../../shared/models');
const { renderQRCodePng } = require('../services/qrCodeService');

const router = express.Router();

/* Rendering a QR PNG costs ~20 ms of CPU, which adds up when the secretary
downloads every card at once. Cache the bytes by everything the image encodes;
the member lookup below still runs on every request, so replaced or revoked
codes stop resolving immediately. */
const PNG_CACHE_LIMIT = 2000;
const pngCache = new Map();
const renderCached = async (member) => {
  const key = JSON.stringify([member.memberId, member.memberName, member.barangay, member.qrCode]);
  let png = pngCache.get(key);
  if (!png) {
    png = await renderQRCodePng(member);
    if (pngCache.size >= PNG_CACHE_LIMIT) pngCache.delete(pngCache.keys().next().value);
    pngCache.set(key, png);
  }
  return png;
};

/* Pinapanatili yung existing public image URLs na ginagamit ng previews, printing,
at downloads, pero yung bytes nila ay nire-rebuild galing MongoDB sa halip na
local files. Yung member's current issued UUID lang ang makaka-resolve - hindi
dapat makapag-expose ng freshly issued code yung old/replaced cards at guessed
filenames. */
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
    const png = await renderCached(member);
    return res.type('png').send(png);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
