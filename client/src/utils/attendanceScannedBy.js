// Use the operator recorded on the attendance entry, never the current viewer.
export const attendanceScannedBy = record => String(record?.scannedBy || '').trim() || 'Not recorded';
