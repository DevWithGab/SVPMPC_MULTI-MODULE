import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield, Users, UserPlus, Upload, Download, Search,
  Mail, Phone, MapPin, Calendar, Key, ArrowLeft, X, Plus,
  CheckCircle, AlertCircle, Loader, Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Toast } from '../components/ui/toast';
import { Modal } from '../components/ui/modal';

const REQUIRED_MEMBER_FIELDS = ['memberName', 'email', 'phoneNumber', 'barangay', 'address'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_PHONE_REGEX = /^(?:\+63|0)9\d{9}$/;

const validateMemberField = (name, rawValue) => {
  const value = (rawValue || '').trim();
  switch (name) {
    case 'memberName':
      if (!value) return 'Full name is required.';
      if (value.length < 2) return "Enter the member's full name.";
      return '';
    case 'email':
      if (!value) return 'Email is required.';
      if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address.';
      return '';
    case 'phoneNumber':
      if (!value) return 'Phone number is required.';
      if (!PH_PHONE_REGEX.test(value.replace(/[\s-]/g, ''))) {
        return 'Use a PH mobile number, e.g. 09171234567.';
      }
      return '';
    case 'barangay':
      if (!value) return 'Barangay is required.';
      return '';
    case 'address':
      if (!value) return 'Address is required.';
      return '';
    default:
      return '';
  }
};

// A labeled field with required marker, inline validation error, and helper
// text — keeps every field in the form consistent (error prevention +
// recognition-over-recall, applied once instead of per-field).
const FormField = React.forwardRef(
  ({ label, name, value, onChange, onBlur, error, hint, required, type = 'text', placeholder, maxLength, listId }, ref) => {
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

const SuperAdmin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Member management state
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Form state
  const [newMember, setNewMember] = useState({
    memberName: '',
    email: '',
    phoneNumber: '',
    barangay: '',
    address: '',
    beneficiaries: '',
    dateOfBirth: '',
    gender: 'male',
    modules: ['attendance', 'mortuary']
  });

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);

  // Create Member form: validation + post-success credential handoff
  const [memberErrors, setMemberErrors] = useState({});
  const [memberTouched, setMemberTouched] = useState({});
  const [createdAccount, setCreatedAccount] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const memberFieldRefs = useRef({});

  const emptyMemberForm = {
    memberName: '',
    email: '',
    phoneNumber: '',
    barangay: '',
    address: '',
    beneficiaries: '',
    dateOfBirth: '',
    gender: 'male',
    modules: ['attendance', 'mortuary']
  };

  const barangayOptions = useMemo(
    () => Array.from(new Set(members.map((m) => m.barangay).filter(Boolean))).sort(),
    [members]
  );

  const isCreateFormDirty = () =>
    REQUIRED_MEMBER_FIELDS.concat('beneficiaries').some(
      (field) => (newMember[field] || '').trim() !== ''
    );

  const handleMemberFieldChange = (name, value) => {
    setNewMember((prev) => ({ ...prev, [name]: value }));
    if (memberTouched[name]) {
      setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, value) }));
    }
  };

  const handleMemberFieldBlur = (name) => {
    setMemberTouched((prev) => ({ ...prev, [name]: true }));
    setMemberErrors((prev) => ({ ...prev, [name]: validateMemberField(name, newMember[name]) }));
  };

  const handleCopyCredential = async (field, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch (error) {
      showToast('Could not copy automatically — please copy it manually.', 'error');
    }
  };

  // Closing the form (X, backdrop, Escape, Cancel) while it has unsaved
  // input asks for confirmation first, so a stray click can't silently
  // discard work (error prevention / user control & freedom).
  const requestCloseCreateModal = () => {
    if (createdAccount) {
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
    setCreatedAccount(null);
    setCopiedField('');
    setNewMember(emptyMemberForm);
    setMemberErrors({});
    setMemberTouched({});
  };

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Login with super_admin credentials
      const response = await adminAPI.login('superadmin', authPassword);
      
      if (response.token) {
        // Store token in localStorage
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        setIsAuthenticated(true);
        fetchMembers();
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
    setLoading(true);
    try {
      const response = await adminAPI.getAllMembers({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery,
        limit: 100
      });
      setMembers(response.members || []);
    } catch (error) {
      showToast('Error fetching members', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMembers();
    }
  }, [statusFilter, searchQuery]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();

    // Validate everything client-side before ever hitting the network —
    // catches the mistake immediately instead of round-tripping to the
    // server first (error prevention).
    const nextErrors = {};
    REQUIRED_MEMBER_FIELDS.forEach((field) => {
      nextErrors[field] = validateMemberField(field, newMember[field]);
    });
    setMemberErrors(nextErrors);
    setMemberTouched(
      REQUIRED_MEMBER_FIELDS.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    const firstInvalidField = REQUIRED_MEMBER_FIELDS.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      memberFieldRefs.current[firstInvalidField]?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.createMember(newMember);
      setCreatedAccount({
        memberName: newMember.memberName,
        username: response.account.username,
        temporaryPassword: response.account.temporaryPassword,
      });
      fetchMembers();
    } catch (error) {
      const message = error.response?.data?.message || 'Error creating member';
      if (/email/i.test(message)) {
        // Surface it right under the field that caused it, not just as a
        // toast the admin has to mentally map back to a field themselves.
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

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV properly handling quoted fields
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        const preview = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
          }, {});
        });
        setCsvPreview(preview);
      };
      reader.readAsText(file);
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile) return;
    
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV properly handling quoted fields
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const headers = parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);
        
        const members = lines.slice(1)
          .filter(line => line.trim())
          .map((line, index) => {
            const values = parseCSVLine(line);
            console.log(`Row ${index + 1} values:`, values);
            
            const memberData = {
              memberName: values[headers.indexOf('memberName')],
              email: values[headers.indexOf('email')],
              phoneNumber: values[headers.indexOf('phoneNumber')],
              barangay: values[headers.indexOf('barangay')],
              address: values[headers.indexOf('address')],
              beneficiaries: values[headers.indexOf('beneficiaries')] || '',
              dateOfBirth: values[headers.indexOf('dateOfBirth')] || '',
              gender: values[headers.indexOf('gender')] || 'male',
              modules: ['attendance', 'mortuary']
            };
            
            // Include memberId if provided in CSV
            const memberIdIndex = headers.indexOf('memberId');
            if (memberIdIndex !== -1 && values[memberIdIndex]) {
              memberData.memberId = values[memberIdIndex];
            }
            
            console.log(`Parsed member ${index + 1}:`, memberData);
            return memberData;
          });

        console.log('Sending members to API:', members);
        const response = await adminAPI.bulkCreateMembers(members);
        console.log('API Response:', response);
        
        showToast(`Bulk upload complete! ${response.summary.successful} successful, ${response.summary.failed} failed`, 'success');
        setShowBulkModal(false);
        setCsvFile(null);
        setCsvPreview([]);
        fetchMembers();
      };
      reader.readAsText(csvFile);
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Error uploading CSV', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (memberId) => {
    if (!confirm('Are you sure you want to reset this member\'s password?')) return;
    
    setLoading(true);
    try {
      const response = await adminAPI.resetMemberPassword(memberId);
      showToast(`Password reset! Username: ${response.username}, New Password: ${response.temporaryPassword}`, 'success');
    } catch (error) {
      showToast('Error resetting password', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Authentication Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <motion.div
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
              <p className="text-center text-emerald-100 text-sm mt-2">Member Management System</p>
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
        </motion.div>
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
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthenticated(false);
                setAuthPassword('');
              }}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase">Total Members</p>
                  <p className="text-3xl font-black text-slate-900 mt-2">{members.length}</p>
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
                    {members.filter(m => m.status === 'active').length}
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
                    {members.filter(m => m.status === 'inactive').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-slate-400" />
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
              placeholder="Search members..."
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
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
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Modules</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {members.map((member) => (
                    <tr key={member.memberId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-slate-900">{member.memberName}</p>
                          <p className="text-sm text-slate-500">{member.memberId}</p>
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
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPassword(member.memberId)}
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          <Key className="w-4 h-4 mr-1" />
                          Reset Password
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Member Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={requestCloseCreateModal}
        title={createdAccount ? 'Member Created' : 'Create New Member'}
        className="max-w-2xl"
      >
        {createdAccount ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  {createdAccount.memberName} was added successfully.
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Credentials were also sent to the member automatically — but copy them
                  now too, since this password won't be shown again.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 overflow-x-auto">
                    {createdAccount.username}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyCredential('username', createdAccount.username)}
                    className="shrink-0"
                    aria-label="Copy username"
                  >
                    {copiedField === 'username' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Temporary Password
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 overflow-x-auto">
                    {createdAccount.temporaryPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyCredential('password', createdAccount.temporaryPassword)}
                    className="shrink-0"
                    aria-label="Copy temporary password"
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
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
                label="Email"
                name="email"
                type="email"
                required
                value={newMember.email}
                onChange={(value) => handleMemberFieldChange('email', value)}
                onBlur={() => handleMemberFieldBlur('email')}
                error={memberTouched.email ? memberErrors.email : ''}
                placeholder="name@example.com"
                ref={(el) => (memberFieldRefs.current.email = el)}
              />
              <FormField
                label="Phone Number"
                name="phoneNumber"
                type="tel"
                required
                value={newMember.phoneNumber}
                onChange={(value) => handleMemberFieldChange('phoneNumber', value)}
                onBlur={() => handleMemberFieldBlur('phoneNumber')}
                error={memberTouched.phoneNumber ? memberErrors.phoneNumber : ''}
                hint={!memberErrors.phoneNumber ? 'Used to send login credentials via SMS.' : undefined}
                placeholder="09171234567"
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

            <FormField
              label="Beneficiaries"
              name="beneficiaries"
              value={newMember.beneficiaries}
              onChange={(value) => handleMemberFieldChange('beneficiaries', value)}
              hint="Optional — comma-separate multiple beneficiaries."
              placeholder="e.g., Maria Dela Cruz (Wife)"
              maxLength={200}
            />

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

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <h3 className="text-xl font-black text-slate-900">Bulk Upload Members</h3>
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-700 mb-2">Upload CSV File</p>
                  <p className="text-xs text-slate-500 mb-4">
                    Format: memberName, email, phoneNumber, barangay, address, beneficiaries
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </label>
                  {csvFile && (
                    <p className="text-sm text-emerald-600 mt-4 font-bold">
                      {csvFile.name} selected
                    </p>
                  )}
                </div>
                {csvPreview.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-2">Preview (first 5 rows):</p>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {Object.keys(csvPreview[0]).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-bold text-slate-600 whitespace-nowrap">{key}</th>
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
                  onClick={() => {
                    setShowBulkModal(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkUpload}
                  disabled={!csvFile || loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload Members
                </Button>
              </div>
            </motion.div>
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
