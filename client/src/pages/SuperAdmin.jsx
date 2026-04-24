import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, UserPlus, Upload, Download, Search, 
  Mail, Phone, MapPin, Calendar, Key, ArrowLeft, X, Plus,
  CheckCircle, AlertCircle, Loader
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Toast } from '../components/ui/toast';

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

  // Super Admin password (in production, this should be environment variable)
  const SUPER_ADMIN_PASSWORD = 'SuperAdmin2024!';

  const handleAuth = (e) => {
    e.preventDefault();
    if (authPassword === SUPER_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError('');
      fetchMembers();
    } else {
      setAuthError('Invalid super admin password');
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
    setLoading(true);
    try {
      const response = await adminAPI.createMember(newMember);
      showToast(`Member created! Username: ${response.account.username}, Password: ${response.account.temporaryPassword}`, 'success');
      setShowCreateModal(false);
      setNewMember({
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
      fetchMembers();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating member', 'error');
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
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const preview = lines.slice(1, 6).map(line => {
          const values = line.split(',');
          return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index]?.trim();
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
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const members = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.trim());
            return {
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
          });

        const response = await adminAPI.bulkCreateMembers(members);
        showToast(`Bulk upload complete! ${response.summary.successful} successful, ${response.summary.failed} failed`, 'success');
        setShowBulkModal(false);
        setCsvFile(null);
        setCsvPreview([]);
        fetchMembers();
      };
      reader.readAsText(csvFile);
    } catch (error) {
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Access Super Admin
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
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-xl font-black text-slate-900">Create New Member</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateMember} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      value={newMember.memberName}
                      onChange={(e) => setNewMember({...newMember, memberName: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                    <input
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      value={newMember.phoneNumber}
                      onChange={(e) => setNewMember({...newMember, phoneNumber: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Barangay *</label>
                    <input
                      type="text"
                      value={newMember.barangay}
                      onChange={(e) => setNewMember({...newMember, barangay: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Address *</label>
                  <input
                    type="text"
                    value={newMember.address}
                    onChange={(e) => setNewMember({...newMember, address: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Beneficiaries</label>
                  <input
                    type="text"
                    value={newMember.beneficiaries}
                    onChange={(e) => setNewMember({...newMember, beneficiaries: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., Maria Dela Cruz (Wife)"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
            >
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
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
              <div className="p-6 space-y-4">
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
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            {Object.keys(csvPreview[0]).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-bold text-slate-600">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              {Object.values(row).map((val, i) => (
                                <td key={i} className="px-3 py-2 text-slate-600">{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 pt-4">
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
