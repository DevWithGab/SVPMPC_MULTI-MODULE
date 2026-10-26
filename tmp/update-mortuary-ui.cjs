const fs = require('fs');
function edit(path, fn) { const old = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n'); const next = fn(old); if (next === old) throw new Error(`No change: ${path}`); fs.writeFileSync(path, next); }
edit('client/src/utils/constants.js', s => s.replace("admin: ['attendance', 'mortuary']", "admin: ['attendance']").replace("treasurer: ['mortuary']", "claims_officer: ['mortuary'],\n  finance_officer: ['mortuary']"));
edit('client/src/utils/navigation.js', s => s.replace('  return MODULE_ROLES[module]?.includes(role)', "  if (module === 'mortuary') role = ({ admin: 'claims_officer', treasurer: 'finance_officer' })[role] || role;\n  return MODULE_ROLES[module]?.includes(role)"));
edit('client/src/hooks/useLoginNavigation.js', s => s.replace("const step = selectedRole ?", "const step = selectedSystem === 'mortuary' ? 'MORTUARY_LOGIN' : selectedRole ?")
 .replace("const parentSearch = selectedRole ?", "const parentSearch = selectedSystem !== 'mortuary' && selectedRole ?"));
edit('client/src/pages/SystemSelector.jsx', s => s.replace('  Calculator,\n', '').replace(/    } else if \(systemId === "mortuary"\) \{[\s\S]*?\n    }/, '    }')
 .replace('          expectedRole: "treasurer",\n', '')
 .replace('onModuleSelect(selectedSystem, "treasurer", data.user, data.token)', "onModuleSelect(selectedSystem, data.user.role === 'super_admin' ? 'claims_officer' : data.user.role, data.user, data.token)")
 .replaceAll('step === "TREASURER_LOGIN"', 'step === "MORTUARY_LOGIN"')
 .replace('type="treasurer"', 'type="mortuary"'));
edit('client/src/components/shared/LoginForm.jsx', s => s.replace('    treasurer: {', '    mortuary: {')
 .replace('title: "Treasurer / Staff Access"', 'title: "Mortuary sign in"')
 .replace('passwordPlaceholder: "Enter treasurer password"', 'passwordPlaceholder: "Enter your password"')
 .replace('helpText: "Treasurer access • Contact administrator for assistance"', 'helpText: "Use your staff account. Your assigned role determines your workspace."')
 .replace('>Back to Role Selection</BackButton>', ">{type === 'mortuary' ? 'Back to System Selection' : 'Back to Role Selection'}</BackButton>"));
edit('client/src/App.jsx', s => s.replace("'/mortuary/admin': MortuaryAdminPortal", "'/mortuary/claims_officer': MortuaryAdminPortal")
 .replace("'/mortuary/treasurer': MortuaryTreasurerPortal", "'/mortuary/finance_officer': MortuaryTreasurerPortal")
 .replace("isSuperAdmin && path.endsWith('/admin')", "isSuperAdmin && (path.endsWith('/admin') || path.startsWith('/mortuary/'))")
 .replaceAll("location.pathname === '/mortuary/admin'", "location.pathname.startsWith('/mortuary/')")
 .replaceAll('to="/mortuary/admin"', 'to="/mortuary/claims_officer"')
 .replace('      <Route path="*"', '      <Route path="/mortuary/admin" element={<Navigate to="/mortuary/claims_officer" replace />} />\n      <Route path="/mortuary/treasurer" element={<Navigate to="/mortuary/finance_officer" replace />} />\n      <Route path="*"'));
edit('client/src/pages/mortuary/AdminPortal.jsx', s => s.replace('  Users,\n', '').replace('  FileText,\n', '').replace('  Shield,\n', '')
 .replace('  MemberManagement,\n', '').replace('  AuditLogs,\n', '').replace('  DatabaseBackup,\n', '')
 .replace('  treasurerAPI,', '  mortuaryDashboardAPI,')
 .replace("['dashboard', 'members', 'claims', 'beneficiaries', 'auditlogs', 'backup']", "['dashboard', 'claims', 'beneficiaries']")
 .replace(/  const \[statusFilter[\s\S]*?const \[searchQuery[^\n]*\n/, '')
 .replace('treasurerAPI.getDashboard()', 'mortuaryDashboardAPI.getFundOverview()').replace('treasurerAPI.getAllMemberBalances()', 'mortuaryDashboardAPI.getBalances()')
 .replace('    { id: "members", label: "Members", icon: Users },\n', '').replace('    { id: "auditlogs", label: "Audit Logs", icon: Shield },\n', '').replace('    { id: "backup", label: "Backup & Restore", icon: FileText },\n', '')
 .replace(/  const filteredMembers = members.filter\([\s\S]*?\n  \}\);\n/, '')
 .replace(/      case "members":[\s\S]*?      case "claims":/, '      case "claims":')
 .replace(/      case "auditlogs":[\s\S]*?      default:/, '      default:')
 .replaceAll('"Admin User"', '"Claims Officer"').replaceAll('"Admin"', '"Claims Officer"').replace('System Administrator', 'Claims Officer').replace('Mortuary Admin', 'Claims Officer'));
edit('client/src/components/mortuary/admin/Dashboard.jsx', s => s.replace(/    \{\n      icon: Users,\n      label: "Manage Members",[\s\S]*?    \},\n/, '')
 .replace('|| "Admin"', '|| "Claims Officer"').replaceAll('Claims and administration', 'Claims overview').replaceAll('Administration workspace', 'Claims workspace'));
edit('client/src/pages/mortuary/TreasurerPortal.jsx', s => s.replace("'Loading treasurer data'", "'Loading finance data'").replace('"Loading treasurer data"', '"Loading finance data"')
 .replaceAll("'Treasurer'", "'Finance Officer'").replace('Fund Treasurer', 'Finance Officer').replace('>Treasurer</h1>', '>Finance Officer</h1>'));
edit('client/src/services/api.js', s => s.replace('export const mortuaryDashboardAPI = {', "export const mortuaryDashboardAPI = {\n  getFundOverview: async () => (await api.get('/mortuary/admin/fund-overview')).data,\n  getBalances: async () => (await api.get('/mortuary/admin/balances')).data,"));
edit('client/src/pages/SuperAdmin.jsx', s => "import MortuaryAuditLogs from '../components/mortuary/admin/AuditLogs';\nimport MortuaryBackup from '../components/mortuary/admin/DatabaseBackup';\n" + s.replace("['members', 'staff', 'auditlogs']", "['members', 'staff', 'auditlogs', 'mortuary-audit', 'mortuary-backup']")
 .replace(">Audit Logs</Button></div>", ">Staff Audit Logs</Button><Button variant={section === 'mortuary-audit' ? 'default' : 'outline'} onClick={() => setSection('mortuary-audit')}>Mortuary Audit Logs</Button><Button variant={section === 'mortuary-backup' ? 'default' : 'outline'} onClick={() => setSection('mortuary-backup')}>Mortuary Backup & Restore</Button></div>")
 .replace("{section === 'auditlogs' && <StaffAuditLog />}", "{section === 'auditlogs' && <StaffAuditLog />}\n        {section === 'mortuary-audit' && <MortuaryAuditLogs />}\n        {section === 'mortuary-backup' && <MortuaryBackup />}"));
