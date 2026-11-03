// Legacy role names remain readable until Super Admin reassigns existing accounts.
const roleModules = {
  secretary: ['attendance'], scanner_operator: ['attendance'],
  claims_officer: ['mortuary'], finance_officer: ['mortuary'],
};
const claimsRoles = ['claims_officer', 'admin', 'super_admin'];
const financeRoles = ['finance_officer', 'treasurer', 'super_admin'];
// Attendance record managers (events, member QR codes) and everyone who may use Attendance.
const secretaryRoles = ['secretary', 'super_admin'];
const attendanceRoles = ['secretary', 'scanner_operator', 'super_admin'];
const moduleRoles = {
  attendance: ['secretary', 'scanner_operator'],
  mortuary: ['claims_officer', 'finance_officer', 'admin', 'treasurer'],
};
module.exports = { roleModules, claimsRoles, financeRoles, secretaryRoles, attendanceRoles, moduleRoles };
