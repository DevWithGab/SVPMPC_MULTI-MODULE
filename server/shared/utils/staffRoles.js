// Legacy role names remain readable until Super Admin reassigns existing accounts.
const roleModules = {
  secretary: ['attendance'], scanner_operator: ['attendance'],
  claims_officer: ['mortuary'], finance_officer: ['mortuary'],
};
const claimsRoles = ['claims_officer', 'admin', 'super_admin'];
const financeRoles = ['finance_officer', 'treasurer', 'super_admin'];
const moduleRoles = {
  attendance: ['secretary', 'scanner_operator'],
  mortuary: ['claims_officer', 'finance_officer', 'admin', 'treasurer'],
};
module.exports = { roleModules, claimsRoles, financeRoles, moduleRoles };
