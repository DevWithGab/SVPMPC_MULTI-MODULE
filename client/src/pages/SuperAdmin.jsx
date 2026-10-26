import { importHeaderLabel } from '../utils/importHeaders';
import { parseMemberUpload, memberUploadError } from '../utils/memberBulkUpload';
import useUrlState from '../hooks/useUrlState';
import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Users, UserPlus, Upload, Download, Search,
  Mail, Phone, MapPin, Calendar, Key, ArrowLeft, X, Plus,
  CheckCircle, AlertCircle, Loader, Power, Pencil, HeartCrack
} from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
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
import { UploadFilePicker, UploadTemplateCard } from '../components/mortuary/shared/BulkUploadDialog';
import { validatePhPhone, sanitizePhoneInput } from '../utils/validation';

const MEMBER_VALIDATION_FIELDS = ['passbookNo', 'memberName', 'email', 'phoneNumber', 'barangay', 'address', 'beneficiaryContactNumber'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateMemberField = (name, rawValue) => {
  const value = (rawValue || '').trim();
  switch (name) {
    case 'memberName':
      if (!value) return 'Full name is required.';
      if (value.length < 2) return "Enter the member's full name.";
      return '';
    case 'email':
      if (!value) return '';
      if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address.';
      return '';
    case 'phoneNumber':
      if (!value) return '';
      /* Shared with mortuary Beneficiary forms - same 11-digit,
      starts-with-09 PH mobile rule, dito lang ginagamit sa buong app. */
      return validatePhPhone(value);
    case 'barangay':
      if (!value) return 'Barangay is required.';
      return '';
    case 'address':
      if (!value) return 'Address is required.';
      return '';
    case 'beneficiaryContactNumber':
      /* Optional - vavalidate lang kung may talagang na-enter. Kung
      naprovide (kasama ang beneficiary name at relationship), sapat na
      yun para auto-register agad bilang proper Beneficiary record
      imbes na iwan as free text na kailangan pang kumpletuhin ng admin. */
      if (!value) return '';
      return validatePhPhone(value);
    default:
      return '';
  }
};

/* Labeled field na may required marker, inline validation error, at helper
text - para consistent yung lahat ng field sa form (error prevention +
recognition-over-recall, ginawa once imbes na per-field). */
const FormField = React.forwardRef(
  ({ label, name, value, onChange, onBlur, error, hint, required, type = 'text', placeholder, maxLength, inputMode, listId }, ref) => {
    const errorId = error ? `${name}-error` : undefined;
    return (
      <div>
        <label htmlFor={name} className="block text-sm font-bold text-slate-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <Input
          id={name}
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          list={listId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={error ? 'border-red-300 focus-visible:ring-red-400' : ''}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-slate-400 mt-1.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = 'FormField';

const SuperAdmin = ({ onAuthenticated }) => {
  const [section, setSection] = useUrlState('tab', 'members', ['members', 'staff', 'auditlogs']);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
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
  
  // Form state
  const [newMember, setNewMember] = useState({
    passbookNo: '',
    memberName: '',
    email: '',
    phoneNumber: '',
    barangay: '',
    address: '',
    beneficiaries: '',
    beneficiaryRelationship: '',
    beneficiaryContactNumber: '',
    dateOfBirth: '',
    gender: 'male',
    modules: ['attendance', 'mortuary']
  });

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const bulkInFlight = useRef(false);

  // Create Member form: validation + post-success confirmation
  const [memberErrors, setMemberErrors] = useState({});
  const [memberTouched, setMemberTouched] = useState({});
  const [createdMember, setCreatedMember] = useState(null);
  const memberFieldRefs = useRef({});

  const emptyMemberForm = {
    passbookNo: '',
    memberName: '',
    email: '',
    phoneNumber: '',
    barangay: '',
    address: '',
    beneficiaries: '',
    beneficiaryRelationship: '',
    beneficiaryContactNumber: '',
    dateOfBirth: '',
    gender: 'male',
    modules: ['attendance', 'mortuary']
  };

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

  const isCreateFormDirty = () =>
    MEMBER_VALIDATION_FIELDS.concat('beneficiaries', 'beneficiaryRelationship').some(
      (field) => (newMember[field] || '').trim() !== ''
    );

  const handleMemberFieldChange = (name, rawValue) => {
    /* Prevention over correction: tanggalin agad ang non-numeric at
    itigil ang pag-accept ng keystrokes pagkalampas ng 11 digits,
    imbes na mag-flag na lang ng error message pagkatapos. */
    const value = (name === 'phoneNumber' || name === 'beneficiaryContactNumber') ? sanitizePhoneInput(rawValue) : rawValue;
    setNewMember((prev) => ({ ...prev, [name]: value }));
    if (memberTouched[name]) {
      setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, value) }));
    }
  };

  const handleMemberFieldBlur = (name) => {
    setMemberTouched((prev) => ({ ...prev, [name]: true }));
    setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, newMember[name]) }));
  };

  /* Pag isasara yung form (X, backdrop, Escape, Cancel) habang may
  unsaved input, magtatanong muna ng confirmation, para hindi na-silent
  discard yung work sa isang stray click (error prevention / user
  control & freedom). */
  const requestCloseCreateModal = () => {
    if (createdMember) {
      finishCreateMember();
      return;
    }
    if (isCreateFormDirty() && !window.confirm("Discard the new member details you've entered?")) {
      return;
    }
    setShowCreateModal(false);
    setNewMember(emptyMemberForm);
    setMemberErrors({});
    setMemberTouched({});
  };

  const finishCreateMember = () => {
    setShowCreateModal(false);
    setCreatedMember(null);
    setNewMember(emptyMemberForm);
    setMemberErrors({});
    setMemberTouched({});
  };

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

  const handleCreateMember = async (e) => {
    e.preventDefault();

    /* I-validate muna lahat client-side bago pa man tumama sa network -
    nahuhuli agad yung mistake imbes na mag-round-trip pa sa server
    (error prevention). */
    const nextErrors = {};
    MEMBER_VALIDATION_FIELDS.forEach((field) => {
      nextErrors[field] = validateMemberField(field, newMember[field]);
    });
    setMemberErrors(nextErrors);
    setMemberTouched(
      MEMBER_VALIDATION_FIELDS.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    const firstInvalidField = MEMBER_VALIDATION_FIELDS.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      memberFieldRefs.current[firstInvalidField]?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.createMember(newMember);
      setCreatedMember(response.member);
      fetchMembers();
    } catch (error) {
      const message = error.response?.data?.message || 'Error creating member';
      if (/passbook/i.test(message)) {
        setMemberErrors((prev) => ({ ...prev, passbookNo: message }));
        setMemberTouched((prev) => ({ ...prev, passbookNo: true }));
        memberFieldRefs.current.passbookNo?.focus();
      } else if (/email/i.test(message)) {
        /* Ipapakita agad sa ilalim ng field na may problema, hindi lang
        toast na kailangan pang i-map balik ng admin sa tamang field. */
        setMemberErrors((prev) => ({ ...prev, email: message }));
        setMemberTouched((prev) => ({ ...prev, email: true }));
        memberFieldRefs.current.email?.focus();
      } else {
        showToast(message, 'error');
      }
    } finally {
      setLoading(false);
    }
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
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setBulkError('Choose a CSV file. Save your spreadsheet as CSV UTF-8 before uploading.');
      return;
    }
    setLoading(true);
    try {
      const parsed = parseMemberUpload(await file.text());
      setCsvPreview(parsed.preview);
      setCsvFile(file);
    } catch (error) {
      setBulkError(error.message || 'Unable to read this file. Please choose it again.');
    } finally { setLoading(false); }
  };

  const handleBulkUpload = async () => {
    if (!csvFile || loading || bulkInFlight.current || bulkResult) return;
    bulkInFlight.current = true;
    setLoading(true);
    setBulkError('');
    try {
      const { members, rowNumbers } = parseMemberUpload(await csvFile.text());
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
    } catch (error) {
      setBulkError(error.response || error.request ? memberUploadError(error) : error.message);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-slate-200 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-8">
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
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Super Admin Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="Enter super admin password"
                      required
                    />
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">Super Admin</h1>
                <p className="text-sm text-slate-500">Member Management System</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-3 mb-6"><Button variant={section === 'members' ? 'default' : 'outline'} onClick={() => setSection('members')}>Members</Button><Button variant={section === 'staff' ? 'default' : 'outline'} onClick={() => setSection('staff')}>Staff Accounts</Button><Button variant={section === 'auditlogs' ? 'default' : 'outline'} onClick={() => setSection('auditlogs')}>Audit Logs</Button></div>
        {section === 'staff' && <StaffAccounts />}
        {section === 'auditlogs' && <StaffAuditLog />}
        <div hidden={section !== 'members'}>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or passbook no..."
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
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

        {/* Members Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Barangay</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Modules</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedMembers.map((member) => (
                    <tr key={member.memberId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{member.memberName}</p>
                          <p className="text-sm text-slate-500">Passbook No.: {member.memberId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </p>
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {member.phoneNumber}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600 flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {member.barangay}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={member.status === 'active' ? 'default' : 'secondary'}
                          className={member.status === 'active' ? 'bg-emerald-100 text-emerald-800' : ''}
                        >
                          {member.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          {member.modules?.map(mod => (
                            <Badge key={mod} variant="outline" className="text-xs">
                              {mod}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditMember(member)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        {['active', 'inactive'].includes(member.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(member)}
                            className={
                              member.status === 'active'
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }
                          >
                            <Power className="w-4 h-4 mr-1" />
                            {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No status action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {membersTotal > 0 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
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

      </div>

      {/* Create Member Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={requestCloseCreateModal}
        title={createdMember ? 'Member Created' : 'Create New Member'}
        className="max-w-2xl"
      >
        {createdMember ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  {createdMember.memberName} was added successfully.
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Passbook No.: {createdMember.memberId}. The member record is ready for attendance and mortuary management.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={finishCreateMember}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateMember} noValidate className="space-y-4">
            <p className="text-xs text-slate-500 -mt-1">
              Fields marked <span className="text-red-500 font-bold">*</span> are required.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Passbook No."
                name="passbookNo"
                value={newMember.passbookNo}
                onChange={(value) => handleMemberFieldChange('passbookNo', value)}
                onBlur={() => handleMemberFieldBlur('passbookNo')}
                error={memberTouched.passbookNo ? memberErrors.passbookNo : ''}
                placeholder="000123"
                hint="Enter the unique passbook number. Leave blank to generate one automatically."
                ref={(el) => (memberFieldRefs.current.passbookNo = el)}
              />
              <FormField
                label="Full Name"
                name="memberName"
                required
                value={newMember.memberName}
                onChange={(value) => handleMemberFieldChange('memberName', value)}
                onBlur={() => handleMemberFieldBlur('memberName')}
                error={memberTouched.memberName ? memberErrors.memberName : ''}
                placeholder="Juan Dela Cruz"
                maxLength={100}
                ref={(el) => (memberFieldRefs.current.memberName = el)}
              />
              <FormField
                label="Email (optional)"
                name="email"
                type="email"
                value={newMember.email}
                onChange={(value) => handleMemberFieldChange('email', value)}
                onBlur={() => handleMemberFieldBlur('email')}
                error={memberTouched.email ? memberErrors.email : ''}
                placeholder="name@example.com"
                ref={(el) => (memberFieldRefs.current.email = el)}
              />
              <FormField
                label="Phone Number (optional)"
                name="phoneNumber"
                type="tel"
                inputMode="numeric"
                value={newMember.phoneNumber}
                onChange={(value) => handleMemberFieldChange('phoneNumber', value)}
                onBlur={() => handleMemberFieldBlur('phoneNumber')}
                error={memberTouched.phoneNumber ? memberErrors.phoneNumber : ''}
                hint={!memberErrors.phoneNumber ? 'Optional contact number. 11 digits, e.g. 09171234567.' : undefined}
                placeholder="09171234567"
                maxLength={11}
                ref={(el) => (memberFieldRefs.current.phoneNumber = el)}
              />
              <FormField
                label="Barangay"
                name="barangay"
                required
                value={newMember.barangay}
                onChange={(value) => handleMemberFieldChange('barangay', value)}
                onBlur={() => handleMemberFieldBlur('barangay')}
                error={memberTouched.barangay ? memberErrors.barangay : ''}
                placeholder="e.g., Domang"
                listId="barangay-options"
                ref={(el) => (memberFieldRefs.current.barangay = el)}
              />
            </div>
            <datalist id="barangay-options">
              {barangayOptions.map((barangay) => (
                <option key={barangay} value={barangay} />
              ))}
            </datalist>

            <FormField
              label="Address"
              name="address"
              required
              value={newMember.address}
              onChange={(value) => handleMemberFieldChange('address', value)}
              onBlur={() => handleMemberFieldBlur('address')}
              error={memberTouched.address ? memberErrors.address : ''}
              placeholder="House No., Street, Barangay"
              maxLength={200}
              ref={(el) => (memberFieldRefs.current.address = el)}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Beneficiaries"
                name="beneficiaries"
                value={newMember.beneficiaries}
                onChange={(value) => handleMemberFieldChange('beneficiaries', value)}
                hint="Optional — comma-separate multiple beneficiaries."
                placeholder="e.g., Maria Dela Cruz"
                maxLength={200}
              />
              <FormField
                label="Relationship"
                name="beneficiaryRelationship"
                value={newMember.beneficiaryRelationship}
                onChange={(value) => handleMemberFieldChange('beneficiaryRelationship', value)}
                hint="Optional — how the beneficiary is related to the member."
                placeholder="e.g., Wife, Son, Sibling"
                maxLength={50}
              />
            </div>

            <div>
              <FormField
                label="Beneficiary Contact Number"
                name="beneficiaryContactNumber"
                value={newMember.beneficiaryContactNumber}
                onChange={(value) => handleMemberFieldChange('beneficiaryContactNumber', value)}
                onBlur={() => handleMemberFieldBlur('beneficiaryContactNumber')}
                error={memberTouched.beneficiaryContactNumber ? memberErrors.beneficiaryContactNumber : ''}
                hint="Optional — if provided along with a beneficiary name above, they're registered automatically instead of showing as 'Not Registered' in Beneficiaries."
                placeholder="09171234567"
                maxLength={11}
                inputMode="numeric"
                ref={(el) => (memberFieldRefs.current.beneficiaryContactNumber = el)}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={requestCloseCreateModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create Member
              </Button>
            </div>
          </form>
        )}
      </Modal>

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
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xl font-black text-slate-900">Bulk Upload Members</h3>
                <button
                  disabled={loading}
                  aria-label="Close bulk member upload"
                  onClick={() => {
                    setShowBulkModal(false);
                    resetBulkUpload();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <UploadTemplateCard onDownload={downloadMemberTemplate} disabled={loading}>
                  <p>Replace the sample row with your members. Keep the column headers and save as CSV UTF-8.</p>
                  <p><strong>Required:</strong> memberName, barangay, address.</p>
                  <p><strong>Optional:</strong> email, phoneNumber, beneficiaries, beneficiaryRelationship, beneficiaryContactNumber, dateOfBirth, gender, Passbook No. Email and phone number may be blank. Any email supplied must be unique. Enter a unique passbook number, or leave Passbook No. blank to generate one automatically. Older member templates are also accepted.</p>
                  <p>Use YYYY-MM-DD for dates and male, female, or other for gender. Blank gender defaults to male.</p>
                  <p>Format Passbook No. and phone columns as Text in your spreadsheet to keep leading zeros (for example, 000123 and 09123456789). Enclose addresses containing commas in double quotes.</p>
                  <p>Provide the beneficiary name, relationship, and contact number together to auto-register a beneficiary. Members are enrolled in Attendance and Mortuary.</p>
                </UploadTemplateCard>
                <UploadFilePicker filename={csvFile?.name} onChange={handleCSVUpload} disabled={loading} hint="Upload your completed member CSV, then review the first five rows below." />
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
                {csvPreview.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Preview (first 5 rows):</p>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {Object.keys(csvPreview[0]).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{importHeaderLabel(key)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              {Object.values(row).map((val, i) => (
                                <td key={i} className="px-3 py-2 text-slate-600 whitespace-nowrap">{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 flex gap-4 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    setShowBulkModal(false);
                    resetBulkUpload();
                  }}
                  className="flex-1"
                >
                  {bulkResult ? 'Done' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  disabled={!csvFile || loading || !!bulkResult}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  {bulkResult ? 'Choose a new file to upload again' : 'Upload Members'}
                </Button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

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
