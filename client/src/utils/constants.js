// App constants

// Single source of truth for which staff roles exist and which modules each
// can access. navigation.js, StaffAccounts.jsx and App.jsx each used to
// maintain their own hand-written copy of this relationship (in two
// different shapes, module->roles and role->modules) with nothing to catch
// the three drifting apart — this is the one place to add, rename, or
// re-scope a role or module now.
export const ROLE_MODULES = {
  admin: ['attendance', 'mortuary'],
  secretary: ['attendance'],
  scanner_operator: ['attendance'],
  treasurer: ['mortuary'],
};

// module -> roles that can access it, derived from ROLE_MODULES so the two
// shapes never drift apart. (navigation.js's portalPath/readSession need
// this direction; StaffAccounts.jsx's staff-creation form needs the other.)
export const MODULE_ROLES = Object.entries(ROLE_MODULES).reduce((acc, [role, modules]) => {
  for (const module of modules) {
    (acc[module] ||= []).push(role);
  }
  return acc;
}, {});