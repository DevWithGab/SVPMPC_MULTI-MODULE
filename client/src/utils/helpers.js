// Helper functions

// A member's barangay is its own required field, captured at registration
// (SuperAdmin → Add Member). Records created before that field existed only
// carry a free-text address, so fall back to the address' first
// comma-separated segment for those — never for a member that has a real
// barangay, or the house/street part of the address gets shown as the
// barangay instead.
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
