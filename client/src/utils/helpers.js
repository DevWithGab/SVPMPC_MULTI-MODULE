// Helper functions

/* Yung barangay ng member ay sarili niyang required field, nakukuha sa
registration (SuperAdmin → Add Member). Pero yung mga records na ginawa
bago pa magexist yung field na yun, address lang (free-text) ang meron,
kaya doon, kukunin nalang yung unang comma-separated segment ng address
bilang fallback - pero never ito gagawin kung may totoong barangay na yung
member, kasi malalagay yung house/street part ng address imbes na barangay. */
export const getBarangay = (member) => {
  const barangay = (member?.barangay || '').trim();
  if (barangay) return barangay;

  const address = (member?.address || '').trim();
  if (!address) return 'Not Specified';

  const derived = address
    .split(',')[0]
    .trim()
    .replace(/^Brgy\.\s*/i, '')
    .replace(/^Barangay\s*/i, '');

  return derived || 'Not Specified';
};
