import CsvDateOrder from '../components/mortuary/shared/CsvDateOrder';
import MortuaryAuditLogs from '../components/mortuary/admin/AuditLogs';
import MortuaryBackup from '../components/mortuary/admin/DatabaseBackup';
import AttendanceAuditLogs from '../components/attendance/admin/AuditLogs';
import AttendanceBackup from '../components/attendance/admin/DatabaseBackup';
import '../components/attendance/shared/AttendanceWorkspace.css';
import { parseMemberUpload, memberUploadError } from '../utils/memberBulkUpload';
import { showBulkUploadResult, showBulkUploadError } from '../utils/bulkUploadAlerts';
import useUrlState from '../hooks/useUrlState';
import { UrlStateContext } from '../hooks/urlStateContext';
import MortuaryAdminPortal from './mortuary/AdminPortal';
import MortuaryTreasurerPortal from './mortuary/TreasurerPortal';
import AttendanceSecretaryPortal from './attendance/SecretaryPortal';
import AttendanceOperatorPortal from './attendance/OperatorPortal';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, UserPlus, Upload, Download, Search,
  MapPin, Calendar, Key, ArrowLeft, Plus, LockKeyhole,
  CheckCircle, AlertCircle, Loader, Power, Pencil, HeartCrack, Eye, EyeOff,
  ClipboardList, Database, ChevronRight, ChevronLeft, Menu, LogOut, UserRound
} from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { adminAPI } from '../services/api';
import StaffAccounts from '../components/shared/StaffAccounts';
import StaffAuditLog from '../components/shared/StaffAuditLog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Toast } from '../components/ui/toast';
import { Modal } from '../components/ui/modal';
import { Pagination, PaginationInfo } from '../components/ui/pagination';
import { usePagination } from '../hooks/usePagination';
import { BulkUploadDialog, UploadFilePicker, UploadTemplateCard } from '../components/mortuary/shared/BulkUploadDialog';
import { Table as DataTable } from '../components/ui/table';
import { sanitizePhoneInput } from '../utils/validation';
import CreateMemberModal, { MemberFormField as FormField } from '../components/shared/CreateMemberModal';
import { validateMemberField } from '../utils/memberValidation';
import './SuperAdmin.css';
import './SuperAdminTypography.css';
import './SuperAdminDesign.css';

const ADMIN_SECTIONS = [
  { group: 'Administration', items: [
    { id: 'members', label: 'Members', icon: Users, title: 'Member management', description: 'Manage shared member records and access across your cooperative.' },
    { id: 'staff', label: 'Staff Accounts', icon: Shield, title: 'Staff accounts', description: 'Manage staff access, roles, and sign-in credentials.' },
    { id: 'auditlogs', label: 'Staff Audit Logs', icon: ClipboardList, title: 'Staff audit logs', description: 'Review changes to staff accounts and access.' },
  ] },
  { group: 'Mortuary', items: [
    { id: 'mortuary-claims', label: 'Claims workspace', icon: HeartCrack, path: '/mortuary/claims_officer', features: [['dashboard', 'Dashboard'], ['members', 'Members'], ['claims', 'Claims'], ['beneficiaries', 'Beneficiaries']] },
    { id: 'mortuary-finance', label: 'Finance workspace', icon: Database, path: '/mortuary/finance_officer', features: [['dashboard', 'Dashboard'], ['members', 'Member Balances'], ['notices', 'Notices'], ['claims', 'Claims'], ['ledger', 'Members Ledger'], ['reports', 'Reports'], ['settings', 'Settings']] },
    { id: 'mortuary-audit', label: 'Audit Logs', icon: ClipboardList },
    { id: 'mortuary-backup', label: 'Backup & Restore', icon: Database },
  ] },
  { group: 'Attendance', items: [
    { id: 'attendance-workspace', label: 'Secretary workspace', icon: Calendar, path: '/attendance/secretary', features: [['dashboard', 'Dashboard'], ['live', 'Live Attendance'], ['events', 'Event Management'], ['members', 'QR Management'], ['reports', 'Reports']] },
    { id: 'attendance-scanner', label: 'Scanner workspace', icon: CheckCircle, path: '/attendance/scanner_operator', features: [['home', 'Dashboard'], ['scanner', 'Scan Attendance'], ['live', 'Live Attendance'], ['myscans', 'My Scans']] },
    { id: 'attendance-audit', label: 'Audit Logs', icon: ClipboardList },
    { id: 'attendance-backup', label: 'Backup & Restore', icon: Database },
  ] },
];

const SuperAdmin = ({ onAuthenticated, onLogout, user, token }) => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({});
  const closeOtherWorkspaces = id => setExpandedWorkspaces(previous => Object.fromEntries(
    ADMIN_SECTIONS.flatMap(group => group.items).filter(item => item.path).map(item => [
      item.id, item.id === id && (previous[item.id] ?? section === item.id),
    ]),
  ));
  const toggleWorkspace = id => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      window.localStorage.setItem('superAdminSidebarCollapsed', 'false');
    }
    setExpandedWorkspaces(previous => Object.fromEntries(
      ADMIN_SECTIONS.flatMap(group => group.items).filter(item => item.path).map(item => [
        item.id, item.id === id && !(previous[id] ?? section === id),
      ]),
    ));
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('superAdminSidebarCollapsed') === 'true');
  const toggleSidebar = () => setSidebarCollapsed(previous => {
    window.localStorage.setItem('superAdminSidebarCollapsed', String(!previous));
    return !previous;
  });
  const [section, setSection] = useUrlState('tab', 'members', ADMIN_SECTIONS.flatMap(group => group.items.map(item => item.id)));
  const [navigationOpen, setNavigationOpen] = useState(false);
  const currentSection = ADMIN_SECTIONS.flatMap(group => group.items).find(item => item.id === section);
  const [feature] = useUrlState('feature', currentSection.features?.[0][0], currentSection.features?.map(([id]) => id));
  const Workspace = { 'mortuary-claims': MortuaryAdminPortal, 'mortuary-finance': MortuaryTreasurerPortal, 'attendance-workspace': AttendanceSecretaryPortal, 'attendance-scanner': AttendanceOperatorPortal }[section];
  const isModuleSection = section.startsWith('mortuary-') || section.startsWith('attendance-');
  const workspaceExpanded = item => expandedWorkspaces[item.id] ?? section === item.id;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Member management state
  const [members, setMembers] = useState([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [memberCounts, setMemberCounts] = useState({ total: 0, active: 0, inactive: 0, deceased: 0 });
  const [barangayList, setBarangayList] = useState([]);
  const membersRequestRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { page: membersPage, limit: membersLimit, setPage: setMembersPage } = usePagination(1, 100);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState(null);
  
  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvDateOrder, setCsvDateOrder] = useState('auto');
  const [csvPreview, setCsvPreview] = useState([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const bulkInFlight = useRef(false);
  const bulkDialog = useRef(null);

  // Edit Member form. Passbook No. stays read-only: ledger, contributions and
  // beneficiaries all reference the member by it.
  const EDIT_VALIDATION_FIELDS = ['memberName', 'email', 'phoneNumber', 'barangay', 'address'];
  const [editMember, setEditMember] = useState(null);
  const [editErrors, setEditErrors] = useState({});

  const openEditMember = (member) => {
    setEditMember({
      memberId: member.memberId,
      memberName: member.memberName || '',
      email: member.email || '',
      phoneNumber: member.phoneNumber || '',
      barangay: member.barangay || '',
      address: member.address || '',
      beneficiaries: member.beneficiaries || '',
      beneficiaryRelationship: member.beneficiaryRelationship || '',
      dateOfBirth: member.dateOfBirth ? String(member.dateOfBirth).slice(0, 10) : '',
      gender: member.gender || 'male',
    });
    setEditErrors({});
  };

  const handleEditFieldChange = (name, rawValue) => {
    const value = name === 'phoneNumber' ? sanitizePhoneInput(rawValue) : rawValue;
    setEditMember((prev) => ({ ...prev, [name]: value }));
    if (editErrors[name]) setEditErrors((prev) => ({ ...prev, [name]: validateMemberField(name, value) }));
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    EDIT_VALIDATION_FIELDS.forEach((field) => {
      nextErrors[field] = validateMemberField(field, editMember[field]);
    });
    setEditErrors(nextErrors);
    if (EDIT_VALIDATION_FIELDS.some((field) => nextErrors[field])) return;

    const { memberId, ...updateData } = editMember;
    setLoading(true);
    try {
      await adminAPI.updateMember(memberId, updateData);
      showToast(`${editMember.memberName} was updated.`, 'success');
      setEditMember(null);
      fetchMembers();
    } catch (error) {
      const message = error.response?.data?.message || 'Error updating member';
      if (/email/i.test(message)) setEditErrors((prev) => ({ ...prev, email: message }));
      else if (/phone/i.test(message)) setEditErrors((prev) => ({ ...prev, phoneNumber: message }));
      else showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const barangayOptions = barangayList;

  // Check for existing authentication on mount
  useEffect(() => {
    const token = window.sessionStorage.getItem('token');
    const user = window.sessionStorage.getItem('user');
    
    if (token && user) {
      const userData = JSON.parse(user);
      if (userData.role === 'super_admin') {
        setIsAuthenticated(true);
        fetchMembers();
      }
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    
    try {
      // Clear any existing tokens before login
      window.sessionStorage.removeItem('token');
      window.sessionStorage.removeItem('user');
      
      // Login with super_admin credentials
      const response = await adminAPI.login('superadmin', authPassword);
      if (response.user?.role !== 'super_admin') throw new Error('Superadmin access required');
      
      if (response.token) {
        // Store token for this browser tab
        window.sessionStorage.setItem('token', response.token);
        window.sessionStorage.setItem('user', JSON.stringify(response.user));
        
        onAuthenticated(response.user, response.token);
        setIsAuthenticated(true);
        if (!response.user.isTemporaryPassword) fetchMembers();
      } else {
        setAuthError('Invalid super admin credentials');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthError(error.response?.data?.message || 'Invalid super admin password');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    // Filter changes reset the page and refetch, so only the latest response may land.
    const requestId = ++membersRequestRef.current;
    setLoading(true);
    try {
      const response = await adminAPI.getAllMembers({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery,
        page: membersPage,
        limit: membersLimit
      });
      if (requestId !== membersRequestRef.current) return;
      setMembers(response.members || []);
      setMembersTotal(response.pagination?.total ?? 0);
      if (response.counts) setMemberCounts(response.counts);
      if (response.barangays) setBarangayList(response.barangays);
    } catch {
      if (requestId === membersRequestRef.current) showToast('Error fetching members', 'error');
    } finally {
      if (requestId === membersRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMembers();
    }
  }, [statusFilter, searchQuery, membersPage]);

  useEffect(() => {
    setMembersPage(1);
  }, [statusFilter, searchQuery, setMembersPage]);

  const membersTotalPages = Math.ceil(membersTotal / membersLimit) || 1;
  const paginatedMembers = members;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const downloadMemberTemplate = () => {
    const csv = [
      'memberName,email,phoneNumber,barangay,address,beneficiaries,beneficiaryRelationship,beneficiaryContactNumber,dateOfBirth,gender,Passbook No.',
      'Juan Dela Cruz,juan.delacruz@example.com,09123456789,Sample Barangay,"123 Sample Street, Sample Barangay",Maria Dela Cruz,Spouse,09987654321,1990-01-15,male,000123',
    ].join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'members-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const resetBulkUpload = () => {
    setCsvFile(null);
    setCsvPreview([]);
    setBulkError('');
    setBulkResult(null);
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    // Allow choosing the same filename after correcting its contents.
    event.target.value = '';
    resetBulkUpload();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) {
      setBulkError('Choose a CSV file of 1 MB or less. Save your spreadsheet as CSV UTF-8 before uploading.');
      return;
    }
    setCsvFile(file);
  };

  const previewMembers = async () => {
    if (!csvFile || loading || bulkResult) return;
    setCsvPreview([]);
    setBulkError('');
    setLoading(true);
    try {
      const parsed = parseMemberUpload(await csvFile.text(), csvDateOrder);
      if (parsed.members.length > 1000) throw new Error('Maximum 1,000 members per upload.');
      setCsvPreview(parsed.members.map((member, index) => ({ ...member, csvRow: parsed.rowNumbers[index] })));
    } catch (error) {
      setBulkError(error.message || 'Unable to read this file. Please choose it again.');
    } finally { setLoading(false); }
  };

  const changeCsvDateOrder = value => {
    setCsvDateOrder(value); setCsvPreview([]); setBulkError(''); setBulkResult(null);
  };

  const handleBulkUpload = async () => {
    if (!csvFile || !csvPreview.length || loading || bulkInFlight.current || bulkResult) return;
    bulkInFlight.current = true;
    setLoading(true);
    setBulkError('');
    try {
      const { members, rowNumbers } = parseMemberUpload(await csvFile.text(), csvDateOrder);
      const response = await adminAPI.bulkCreateMembers(members);
      setBulkResult({
        ...response,
        results: {
          ...response.results,
          failed: response.results.failed.map(row => ({
            ...row,
            row: rowNumbers[row.row - 2] ?? row.row,
          })),
        },
      });
      // Keep failures visible and prevent resubmitting successful rows.
      if (response.summary.successful > 0) fetchMembers();
      await showBulkUploadResult({
        target: bulkDialog.current,
        imported: response.summary.successful,
        failed: response.summary.failed,
        successTitle: 'Members uploaded successfully',
        retryMessage: 'Correct the listed errors and upload a new CSV containing only the failed members. Do not upload successful members again.',
      });
    } catch (error) {
      const message = error.response || error.request ? memberUploadError(error) : error.message;
      setBulkError(message);
      await showBulkUploadError(message, bulkDialog.current);
    } finally {
      bulkInFlight.current = false;
      setLoading(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const activating = member.status !== 'active';
    const verb = activating ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${verb} ${member.memberName}?`)) return;

    setLoading(true);
    try {
      await adminAPI.toggleMemberStatus(member.memberId);
      showToast(`${member.memberName} was ${activating ? 'activated' : 'deactivated'}.`, 'success');
      fetchMembers();
    } catch (error) {
      showToast(error.response?.data?.message || `Error trying to ${verb} this member`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Authentication Screen
  if (!isAuthenticated) {
    return (
      <div className="super-admin-theme min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-200 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader
              className="bg-emerald-900 bg-cover bg-center text-white p-8"
              style={{
                backgroundImage: 'linear-gradient(rgb(from var(--ui-primary-hover) r g b / 72%), rgb(from var(--ui-primary-hover) r g b / 88%)), url("/images/backgrounds/building-coop.png")',
                '--ui-heading': '#ffffff',
                '--ui-muted': '#e1f2e9',
                alignItems: 'center',
              }}
            >
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Shield className="w-8 h-8" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-black">Super Admin Access</CardTitle>
              <p className="text-center text-emerald-100 text-sm mt-2">Modules, Staff Accounts & Members</p>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleAuth} className="space-y-6">
                <div>
                  <label htmlFor="super-admin-password" className="block text-sm font-bold text-slate-700 mb-2">
                    Super Admin Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="super-admin-password"
                      type={showAuthPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full pl-12 pr-14 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Enter super admin password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(visible => !visible)}
                      aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showAuthPassword}
                      aria-controls="super-admin-password"
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      {showAuthPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                    </button>
                  </div>
                  {authError && (
                    <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {authError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 mr-2" />
                      Access Super Admin
                    </>
                  )}
                </Button>
              </form>
              <div className="mt-6 text-center">
                <a href="/" className="text-sm text-slate-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </a>
              </div>
            </CardContent>
          </Card>
        </Motion.div>
      </div>
    );
  }

  // Main Super Admin Dashboard
  return (
    <div className={`${isModuleSection ? 'super-admin-modules' : 'super-admin-theme'}${Workspace ? '' : ' super-admin-design'} min-h-screen bg-slate-50`}>
      <div className={`sam-shell${sidebarCollapsed ? ' sam-shell-collapsed' : ''}`}>
      <aside className="sam-sidebar super-admin-design super-admin-theme">
        <div className="sam-brand"><img src="/SVPMPC-LOGO(MAIN).png" alt="SVPMPC logo" /><div><strong>SVPMPC</strong><p>Saint Vincent Parish<br />Multi-Purpose Cooperative</p></div></div>
        <button type="button" className="sam-mobile-navigation" aria-expanded={navigationOpen} aria-controls="sam-navigation" onClick={() => setNavigationOpen(open => !open)}><Menu size={18} aria-hidden="true" />{currentSection.label}<ChevronRight size={16} aria-hidden="true" /></button>
        <nav id="sam-navigation" className={`sam-navigation${navigationOpen ? ' is-open' : ''}`} aria-label="Administration sections">
          {ADMIN_SECTIONS.map(group => <div className="sam-nav-group" key={group.group}><p>{group.group}</p>{group.items.map(item => item.path
            ? <div key={item.id} className="sam-workspace">
              <button type="button" aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} aria-expanded={workspaceExpanded(item)} aria-controls={`${item.id}-features`} onClick={() => toggleWorkspace(item.id)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span><ChevronRight className="sam-workspace-chevron" size={14} aria-hidden="true" /></button>
              <div id={`${item.id}-features`} className="sam-submenu" hidden={!workspaceExpanded(item)}>
                {item.features.map(([tab, label]) => <Link key={tab} to={`/super-admin?tab=${item.id}&feature=${tab}`} aria-current={section === item.id && feature === tab ? 'page' : undefined} onClick={() => setNavigationOpen(false)}>{label}</Link>)}
              </div>
            </div>
            : <button type="button" key={item.id} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} aria-current={section === item.id ? 'page' : undefined} onClick={() => { closeOtherWorkspaces(); setSection(item.id); setNavigationOpen(false); }}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></button>)}</div>)}
        </nav>
        <div className="sam-account"><div><UserRound size={22} aria-hidden="true" /><span>Super Admin</span></div>{onLogout && <button type="button" onClick={onLogout} aria-label="Sign Out" title="Sign Out"><LogOut size={18} aria-hidden="true" /><span>Sign Out</span></button>}</div>
        <button type="button" className="sam-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
      <main className={`sam-main${Workspace ? ' sam-main-module' : ''}`}>
        {!isModuleSection && <nav className="sam-breadcrumb" aria-label="Breadcrumb"><span>Super admin</span><span aria-hidden="true">/</span><strong aria-current="page">{currentSection.label}</strong></nav>}
        {currentSection.title && <header className="sam-page-heading"><h1>{currentSection.title}</h1><p>{currentSection.description}</p></header>}
        {Workspace && <div className="sam-embedded-workspace" key={section}>
          <UrlStateContext.Provider value={{ tab: 'feature' }}><Workspace embedded user={user} token={token} onBack={onLogout} /></UrlStateContext.Provider>
        </div>}
        {section === 'staff' && <StaffAccounts />}
        {section === 'auditlogs' && <StaffAuditLog />}
        {section === 'mortuary-audit' && <MortuaryAuditLogs />}
        {section === 'mortuary-backup' && <MortuaryBackup />}
        {section === 'attendance-audit' && <div className="attendance-workspace" style={{ height: 'auto' }}><AttendanceAuditLogs /></div>}
        {section === 'attendance-backup' && <div className="attendance-workspace" style={{ height: 'auto' }}><AttendanceBackup onRestored={fetchMembers} /></div>}
        <div hidden={section !== 'members'}>
        {/* Stats Cards */}
        <div className="sam-stats grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Total Members</p>
                  <p className="text-3xl font-black text-slate-900 mt-2">{memberCounts.total}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Active</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">
                    {memberCounts.active}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Inactive</p>
                  <p className="text-3xl font-black text-slate-400 mt-2">
                    {memberCounts.inactive}
                  </p>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Deceased</p>
                  <p className="text-3xl font-black text-rose-600 mt-2">
                    {memberCounts.deceased}
                  </p>
                </div>
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center">
                  <HeartCrack className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="sam-member-toolbar flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              aria-label="Search members"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or passbook no..."
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter members by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deceased">Deceased</option>
            </select>
            <Button
              onClick={() => setShowBulkModal(true)}
              variant="outline"
              className="rounded-xl"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button
              onClick={fetchMembers}
              variant="outline"
              className="rounded-xl"
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Shared member register */}
        <Card className="sam-member-register">
          <CardContent className="p-0">
            <div className="sam-register-heading"><div><h2>Member directory</h2><p>Shared membership records and assigned modules.</p></div><span className="sam-result-count">{membersTotal.toLocaleString()} {membersTotal === 1 ? 'member' : 'members'}</span></div>
            <div className="sam-table-scroll" role="region" aria-label="Member directory" tabIndex={0}>
              <table className="sam-members-table" aria-label="Shared member records" aria-busy={loading}>
                <colgroup><col className="sam-col-member" /><col className="sam-col-contact" /><col className="sam-col-barangay" /><col className="sam-col-status" /><col className="sam-col-modules" /><col className="sam-col-actions" /></colgroup>
                <thead><tr><th scope="col">Member</th><th scope="col">Contact details</th><th scope="col">Barangay</th><th scope="col">Membership</th><th scope="col">Modules</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {paginatedMembers.map(member => <tr key={member.memberId}>
                    <td data-label="Member"><strong className="sam-member-name" title={member.memberName}>{member.memberName || 'Unnamed member'}</strong><span className="sam-passbook" title={`Passbook: ${member.memberId}`}>Passbook <span>{member.memberId}</span></span></td>
                    <td data-label="Contact details"><div className="sam-contact"><span className={!member.email ? 'sam-muted' : ''} title={member.email || undefined}>{member.email || 'No email recorded'}</span><span className="sam-phone">{member.phoneNumber || 'No phone recorded'}</span></div></td>
                    <td data-label="Barangay"><span className="sam-barangay"><MapPin size={13} aria-hidden="true" />{member.barangay || 'Not recorded'}</span></td>
                    <td data-label="Membership"><Badge variant="outline" className={`sam-membership sam-status-${member.status}`}><span aria-hidden="true" />{member.status}</Badge></td>
                    <td data-label="Modules"><div className="sam-modules">{member.modules?.length ? member.modules.map(module => <Badge key={module} variant="outline" className="sam-module">{module}</Badge>) : <span className="sam-muted">Not assigned</span>}</div></td>
                    <td data-label="Actions"><div className="sam-member-actions">
                      <Button variant="outline" size="sm" disabled={loading} tooltip="Update member details." onClick={() => openEditMember(member)} aria-label={`Edit ${member.memberName}`} className="sam-edit"><Pencil size={14} aria-hidden="true" />Edit</Button>
                      {['active', 'inactive'].includes(member.status) ? <Button variant="outline" size="sm" disabled={loading} tooltip={member.status === 'active' ? 'Mark this membership inactive.' : 'Mark this membership active.'} onClick={() => handleToggleStatus(member)} aria-label={`${member.status === 'active' ? 'Deactivate' : 'Activate'} ${member.memberName}`} className={`sam-toggle ${member.status === 'active' ? 'sam-deactivate' : 'sam-activate'}`}><Power size={14} aria-hidden="true" />{member.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                        : <span className="sam-status-locked" title="Only active or inactive memberships can be changed here."><LockKeyhole size={13} aria-hidden="true" />Status locked</span>}
                    </div></td>
                  </tr>)}
                  {!paginatedMembers.length && <tr><td colSpan={6}><div className="sam-empty"><Users size={26} aria-hidden="true" /><strong>{loading ? 'Loading member records...' : 'No members to display'}</strong>{!loading && <p>Try a different name, passbook number, or membership status.</p>}</div></td></tr>}
                </tbody>
              </table>
            </div>
            {membersTotal > 0 && (
              <div className="sam-register-pagination">
                <PaginationInfo currentPage={membersPage} limit={membersLimit} total={membersTotal} />
                <Pagination
                  currentPage={membersPage}
                  totalPages={membersTotalPages}
                  onPageChange={setMembersPage}
                  hasNextPage={membersPage < membersTotalPages}
                  hasPrevPage={membersPage > 1}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      </main>
      </div>

      {/* Create Member Modal */}
      <CreateMemberModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        barangays={barangayOptions}
        createMember={adminAPI.createMember}
        onCreated={fetchMembers}
        onError={(message) => showToast(message, 'error')}
      />

      {/* Edit Member Modal */}
      <Modal
        isOpen={Boolean(editMember)}
        onClose={() => setEditMember(null)}
        title="Edit Member"
        className="max-w-2xl"
      >
        {editMember && (
          <form onSubmit={handleUpdateMember} noValidate className="space-y-4">
            <p className="text-xs text-slate-500 -mt-1">
              Passbook No.: <span className="font-bold text-slate-700">{editMember.memberId}</span> (cannot be changed).
              Fields marked <span className="text-red-500 font-bold">*</span> are required.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Full Name"
                name="edit-memberName"
                required
                value={editMember.memberName}
                onChange={(value) => handleEditFieldChange('memberName', value)}
                error={editErrors.memberName}
                maxLength={100}
              />
              <FormField
                label="Email (optional)"
                name="edit-email"
                type="email"
                value={editMember.email}
                onChange={(value) => handleEditFieldChange('email', value)}
                error={editErrors.email}
                placeholder="name@example.com"
              />
              <FormField
                label="Phone Number (optional)"
                name="edit-phoneNumber"
                type="tel"
                inputMode="numeric"
                value={editMember.phoneNumber}
                onChange={(value) => handleEditFieldChange('phoneNumber', value)}
                error={editErrors.phoneNumber}
                placeholder="09171234567"
                maxLength={11}
              />
              <FormField
                label="Barangay"
                name="edit-barangay"
                required
                value={editMember.barangay}
                onChange={(value) => handleEditFieldChange('barangay', value)}
                error={editErrors.barangay}
                listId="barangay-options"
              />
            </div>

            <FormField
              label="Address"
              name="edit-address"
              required
              value={editMember.address}
              onChange={(value) => handleEditFieldChange('address', value)}
              error={editErrors.address}
              maxLength={200}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Beneficiaries"
                name="edit-beneficiaries"
                value={editMember.beneficiaries}
                onChange={(value) => handleEditFieldChange('beneficiaries', value)}
                maxLength={200}
              />
              <FormField
                label="Relationship"
                name="edit-beneficiaryRelationship"
                value={editMember.beneficiaryRelationship}
                onChange={(value) => handleEditFieldChange('beneficiaryRelationship', value)}
                maxLength={50}
              />
              <FormField
                label="Date of Birth"
                name="edit-dateOfBirth"
                type="date"
                value={editMember.dateOfBirth}
                onChange={(value) => handleEditFieldChange('dateOfBirth', value)}
              />
              <div>
                <label htmlFor="edit-gender" className="block text-sm font-bold text-slate-700 mb-2">Gender</label>
                <select
                  id="edit-gender"
                  value={editMember.gender}
                  onChange={(e) => handleEditFieldChange('gender', e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditMember(null)} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Upload Modal */}
        {showBulkModal && (
          <BulkUploadDialog dialogRef={bulkDialog} title="Bulk Upload Members"
            description="Preview every member before importing into Attendance and Mortuary."
            busy={loading} onClose={() => { setShowBulkModal(false); resetBulkUpload(); }}
            footer={<>
              <Button type="button" variant="outline" disabled={loading} onClick={() => { setShowBulkModal(false); resetBulkUpload(); }}>{bulkResult ? 'Done' : 'Cancel'}</Button>
              <Button type="button" variant="outline" disabled={!csvFile || loading || !!bulkResult} onClick={previewMembers}>{csvPreview.length ? 'Preview Again' : 'Preview Entries'}</Button>
              {!!csvPreview.length && !bulkResult && <Button type="button" disabled={loading} onClick={handleBulkUpload} className="gap-2 bg-coop-green text-white hover:bg-coop-darkGreen"><Upload className="h-4 w-4" aria-hidden="true" />Import {csvPreview.length} {csvPreview.length === 1 ? 'Member' : 'Members'}</Button>}
            </>}>
                <UploadTemplateCard onDownload={downloadMemberTemplate} disabled={loading}>
                  <p>Replace the sample row with your members. Keep the column headers and save as CSV UTF-8.</p>
                  <p><strong>Required:</strong> memberName, barangay, address.</p>
                  <p><strong>Optional:</strong> email, phoneNumber, beneficiaries, beneficiaryRelationship, beneficiaryContactNumber, dateOfBirth, gender, Passbook No. Email and phone number may be blank. Any email supplied must be unique. Enter a unique passbook number, or leave Passbook No. blank to generate one automatically. Older member templates are also accepted.</p>
                  <p>YYYY-MM-DD is the recommended date format. Use male, female, or other for gender. Blank gender defaults to male.</p>
                  <p>Format Passbook No. and phone columns as Text in your spreadsheet to keep leading zeros (for example, 000123 and 09123456789). Enclose addresses containing commas in double quotes.</p>
                  <p>Provide the beneficiary name, relationship, and contact number together to auto-register a beneficiary. Members are enrolled in Attendance and Mortuary.</p>
                </UploadTemplateCard>
                <section aria-label="Member field requirements" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <h4 className="font-semibold text-slate-900">Field requirements</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li><strong>Required:</strong> memberName, barangay, address. Enter a value for every member.</li>
                    <li><strong>Passbook No. — optional:</strong> enter a unique number and keep leading zeros, or leave blank to generate one.</li>
                    <li><strong>Contact — optional:</strong> email must be valid and unique if supplied. phoneNumber must contain 11 digits starting with 09.</li>
                    <li><strong>dateOfBirth and gender — optional:</strong> use a valid date (YYYY-MM-DD recommended) and male, female, or other. Blank gender defaults to male.</li>
                    <li><strong>Beneficiary — optional:</strong> supply beneficiaries, beneficiaryRelationship, and beneficiaryContactNumber together to register a beneficiary. Use an 11-digit contact number starting with 09.</li>
                  </ul>
                </section>
                <UploadFilePicker filename={csvFile?.name} onChange={handleCSVUpload} disabled={loading} hint="CSV only · Up to 1,000 members · Maximum 1 MB" />
                <CsvDateOrder value={csvDateOrder} onChange={changeCsvDateOrder} disabled={loading || !!bulkResult} />
                {bulkError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{bulkError}</div>}
                {bulkResult && <div role="status" className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                  <p className="font-semibold">{bulkResult.summary.successful} members created. {bulkResult.summary.failed} members could not be created.</p>
                  <p className="mt-2">{bulkResult.summary.failed ? 'Correct the rows listed below and upload a new CSV containing only those failed members. Members created successfully must not be uploaded again.' : 'All members were created successfully. You can close this window or choose another file.'}</p>
                </div>}
                {!!bulkResult?.results?.failed?.length && <div className="overflow-x-auto rounded-lg border border-red-200">
                  <table className="w-full text-left text-sm">
                    <caption className="p-3 text-left font-semibold text-red-800">Members that need correction</caption>
                    <thead className="bg-red-50"><tr>{['CSV row', 'Member', 'Reason'].map(label => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
                    <tbody>{bulkResult.results.failed.map((row, index) => <tr key={index} className="border-t border-red-100">
                      <td className="px-3 py-3">{row.row ?? 'Not provided'}</td>
                      <td className="px-3 py-3"><p>{row.memberName || 'Name missing'}</p><p className="text-slate-500">{row.email}</p></td>
                      <td className="px-3 py-3 text-red-800">{row.reason}</td>
                    </tr>)}</tbody>
                  </table>
                </div>}
                {!!csvPreview.length && !bulkResult && <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p><strong>{csvPreview.length} members to import</strong> · All rows shown below</p>
                  <p className="mt-2">Review all entries below. Member details and existing passbook numbers or emails are checked when importing.</p>
                </div>}
                {!!csvPreview.length && !bulkResult && <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
                  <DataTable className="w-full text-left text-sm">
                    <caption className="sr-only">Member entries to import</caption>
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>
                      {['Row', 'Member', 'Barangay', 'Address', 'Contact', 'Birth date', 'Gender', 'Beneficiary'].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">{csvPreview.map(row => <tr key={row.csvRow}>
                      <td className="px-3 py-3">{row.csvRow}</td>
                      <td className="px-3 py-3"><p className="font-medium">{row.memberName || 'Name missing'}</p><p className="text-xs text-slate-500">Passbook No.: {row.passbookNo || 'Auto-generated'}</p></td>
                      <td className="px-3 py-3">{row.barangay}</td>
                      <td className="min-w-48 px-3 py-3">{row.address}</td>
                      <td className="px-3 py-3 break-all"><p>{row.email || 'No email'}</p><p className="text-xs text-slate-500">{row.phoneNumber || 'No phone number'}</p></td>
                      <td className="px-3 py-3 whitespace-nowrap">{row.dateOfBirth || 'Not provided'}</td>
                      <td className="px-3 py-3">{row.gender}</td>
                      <td className="px-3 py-3"><p>{row.beneficiaries || 'Not provided'}</p><p className="text-xs text-slate-500">{row.beneficiaryRelationship}</p><p className="text-xs text-slate-500">{row.beneficiaryContactNumber}</p></td>
                    </tr>)}</tbody>
                  </DataTable>
                </div>}
          </BulkUploadDialog>
        )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={5000}
        />
      )}
    </div>
  );
};

export default SuperAdmin;
