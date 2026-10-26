// App constants

/* Ito yung single source of truth kung anong staff roles meron at anong
modules ang maaccess ng bawat isa. Dati, nagmemaintain ng sariling
hand-written copy nito yung navigation.js, StaffAccounts.jsx, at App.jsx
(sa dalawang ibang shape, module->roles at role->modules) na walang
nakakaalam kung magkakaiba na sila - dito na lang idadagdag, ipapalit ang
pangalan, o ire-scope yung role o module ngayon. */
export const ROLE_MODULES = {
  admin: ['attendance'],
  secretary: ['attendance'],
  scanner_operator: ['attendance'],
  claims_officer: ['mortuary'],
  finance_officer: ['mortuary'],
};

/* module -> roles na maaccess ito, derived mula sa ROLE_MODULES para hindi
magkakaiba yung dalawang shape. (Kailangan ng portalPath/readSession ng
navigation.js yung direction na ito; kailangan ng staff-creation form ng
StaffAccounts.jsx yung iba.) */
export const MODULE_ROLES = Object.entries(ROLE_MODULES).reduce((acc, [role, modules]) => {
  for (const module of modules) {
    (acc[module] ||= []).push(role);
  }
  return acc;
}, {});