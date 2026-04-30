import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Users, FileText, 
  BarChart3, Settings, UserCheck, LayoutGrid
} from 'lucide-react';
import { 
  Dashboard, 
  MemberManagement, 
  Reports
} from '../../components/mortuary/admin';
import Settings from '../../components/mortuary/admin/Settings';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import AddMemberModal from '../../components/mortuary/admin/modals/AddMemberModal';
import AddContributionModal from '../../components/mortuary/admin/modals/AddContributionModal';
import AddPayoutModal from '../../components/mortuary/admin/modals/AddPayoutModal';
import SendSMSModal from '../../components/mortuary/admin/modals/SendSMSModal';
import { ToastContainer, useToast } from '../../components/ui/toast';
import { 
  memberAPI, 
  contributionAPI, 
  mortuaryDashboardAPI,
  adminAPI,
  treasurerAPI,
  payoutAPI,
  mortuaryMemberAPI
} from '../../services/api';

const AdminPortal = ({ onBack }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  
  // State for data
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [contributionSearch, setContributionSearch] = useState('');
  const [contributionStatusFilter, setContributionStatusFilter] = useState('all');
  
  // Modal states
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddContributionOpen, setIsAddContributionOpen] = useState(false);
  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsData, setSmsData] = useState({ memberId: null, message: '', memberName: '' });
  const [selectedMember, setSelectedMember] = useState(null);
  
  // System settings
  const [systemSettings, setSystemSettings] = useState({
    annualGoal: 5000000,
    monthlyContribution: 500,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel - use mortuary-specific endpoints
      const [membersRes, contributionsRes, payoutsRes, dashboardRes] = await Promise.all([
        mortuaryMemberAPI.getAllMembers(), // Use mortuaryMemberAPI
        contributionAPI.getAllContributions(),
        payoutAPI.getAllPayouts(),
        treasurerAPI.getDashboard().catch(() => null) // Don't fail if dashboard fails
      ]);

      if (membersRes.members) {
        setMembers(membersRes.members);
      }

      if (contributionsRes.contributions) {
        setContributions(contributionsRes.contributions);
      }

      if (payoutsRes.payouts) {
        setPayouts(payoutsRes.payouts);
      }
      
      if (dashboardRes) {
        setStats({
          fundBalance: dashboardRes.fundBalance || 0,
          activeMembers: membersRes.members?.length || 0,
          totalPayouts: payoutsRes.payouts?.reduce((sum, p) => sum + p.amount, 0) || 0,
        });
      } else {
        setStats({
          fundBalance: 0,
          activeMembers: membersRes.members?.length || 0,
          totalPayouts: payoutsRes.payouts?.reduce((sum, p) => sum + p.amount, 0) || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      // Set fallback data
      setStats({
        fundBalance: 0,
        activeMembers: members.length,
        totalPayouts: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    // Claims functionality removed from admin portal
    console.log('Claims functionality moved to treasurer portal');
  };

  const updateProfileStatus = async (id, status) => {
    // Profile updates functionality removed from admin portal
    console.log('Profile updates functionality removed');
  };

  const showToast = (message, type) => {
    addToast(message, type);
  };

  // Add member function
  const handleAddMember = async (memberData) => {
    try {
      const response = await adminAPI.createMember(memberData);
      if (response.success) {
        setMembers(prev => [...prev, response.member]);
        setIsAddMemberOpen(false);
        showToast('Member added successfully', 'success');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showToast('Failed to add member', 'error');
    }
  };

  // Record contribution function
  const handleRecordContribution = async (contributionData) => {
    try {
      const response = await contributionAPI.recordContribution(contributionData);
      if (response.success) {
        setContributions(prev => [...prev, response.contribution]);
        setIsAddContributionOpen(false);
        showToast('Contribution recorded successfully', 'success');
      }
    } catch (error) {
      console.error('Error recording contribution:', error);
      showToast('Failed to record contribution', 'error');
    }
  };

  // Record payout function
  const handleRecordPayout = async (payoutData) => {
    try {
      const response = await payoutAPI.recordPayout(payoutData);
      if (response.success) {
        setPayouts(prev => [...prev, response.payout]);
        setIsAddPayoutOpen(false);
        showToast('Payout recorded successfully', 'success');
      }
    } catch (error) {
      console.error('Error recording payout:', error);
      showToast('Failed to record payout', 'error');
    }
  };

  // Send SMS function
  const handleSendSMS = async (smsData) => {
    try {
      const response = await treasurerAPI.sendReminderToMember({
        memberId: smsData.memberId,
        message: smsData.message,
        type: 'manual'
      });
      if (response.success) {
        setIsSmsModalOpen(false);
        setSmsData({ memberId: null, message: '', memberName: '' });
        showToast('SMS sent successfully', 'success');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      showToast('Failed to send SMS', 'error');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'backup', label: 'Database Backup', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredMembers = members.filter(member => {
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesSearch = member.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         member.id?.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading mortuary system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 relative flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-100">
                  <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: '#2D7A3E' }}>Mortuary Admin</h2>
                  <p className="text-sm text-gray-600">Fund Management</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-100">
                <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-8 h-8 object-contain" />
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>
        </div>

        <nav className="mt-4 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-100 transition-colors ${
                  activeSection === item.id 
                    ? 'border-r-2 text-white' 
                    : 'text-gray-700'
                }`}
                style={activeSection === item.id ? {
                  backgroundColor: '#2D7A3E',
                  borderRightColor: '#F2E416'
                } : {}}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!sidebarCollapsed && <span className="ml-3">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Back Button */}
        {onBack && (
          <div className="p-4 border-t border-gray-200 mt-auto">
            {!sidebarCollapsed ? (
              <button
                onClick={onBack}
                className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
              >
                <ChevronLeft size={20} className="inline mr-2" />
                Back to Login
              </button>
            ) : (
              <button
                onClick={onBack}
                className="w-full h-10 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 flex items-center justify-center transition-colors"
                title="Back to Login"
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeSection === 'dashboard' && (
            <Dashboard
              stats={stats}
              contributions={contributions}
              payouts={payouts}
              members={members}
              setActiveTab={setActiveSection}
            />
          )}

          {activeSection === 'members' && (
            <MemberManagement
              filteredMembers={filteredMembers}
              members={members}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              contributions={contributions}
              setIsAddMemberOpen={setIsAddMemberOpen}
              setIsSmsModalOpen={setIsSmsModalOpen}
              setSmsData={setSmsData}
              setSelectedMember={setSelectedMember}
              onAddMember={handleAddMember}
              onSendSMS={handleSendSMS}
            />
          )}

          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Database Backup</h2>
                  <p className="text-slate-500 mt-1">Export and secure your mortuary fund data for emergency recovery</p>
                </div>
              </div>

              {/* Backup Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <Users className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Members</p>
                    <p className="text-xl font-black text-slate-900">{members.length}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <FileText className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Backup</p>
                    <p className="text-xl font-black text-slate-900">Never</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-200/40 flex items-center space-x-4">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Size</p>
                    <p className="text-xl font-black text-slate-900">{(JSON.stringify(members).length / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              </div>

              {/* Backup Options */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Members CSV Backup */}
                <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-emerald-50 rounded-xl flex-shrink-0">
                        <Users className="w-6 h-6 text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-slate-900">Members Database</h3>
                        <p className="text-sm text-slate-500 mt-1">Export all member records in CSV format</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Total Records</span>
                        <span className="font-black text-slate-900">{members.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Format</span>
                        <span className="font-black text-slate-900">CSV</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Includes</span>
                        <span className="font-black text-slate-900">All Fields</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-200/40"
                      onClick={() => {
                        const csv = [
                          ['ID', 'Name', 'Email', 'Phone', 'Barangay', 'Address', 'Beneficiaries', 'Status', 'Join Date'].join(','),
                          ...members.map(m => [
                            m.id, m.name, m.email || '', m.contact || '', m.barangay || '', m.address || '', 
                            m.beneficiaries || '', m.status, m.join_date || ''
                          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                        ].join('\\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `members_backup_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        addToast('Members backup downloaded successfully', 'success');
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Download Members CSV
                    </Button>
                  </div>
                </Card>

                {/* Full JSON Backup */}
                <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
                        <BarChart3 className="w-6 h-6 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-slate-900">Complete System Backup</h3>
                        <p className="text-sm text-slate-500 mt-1">Full database export in JSON format</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Members</span>
                        <span className="font-black text-slate-900">{members.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Format</span>
                        <span className="font-black text-slate-900">JSON</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Includes</span>
                        <span className="font-black text-slate-900">All Data + Stats</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200/40"
                      onClick={() => {
                        const data = {
                          exportDate: new Date().toISOString(),
                          exportVersion: '1.0',
                          system: 'Mortuary Fund Management',
                          members: members,
                          stats: stats,
                          metadata: {
                            totalMembers: members.length,
                            activeMembers: members.filter(m => m.status === 'active').length,
                            exportedBy: 'Admin'
                          }
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `full_backup_${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        addToast('Full backup downloaded successfully', 'success');
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Download JSON Backup
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Backup Instructions */}
              <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 bg-amber-50/30">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-slate-900 mb-2">Backup Best Practices</h3>
                      <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-black mt-0.5">•</span>
                          <span><strong className="font-bold text-slate-900">Regular Backups:</strong> Download backups weekly or after major data changes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-black mt-0.5">•</span>
                          <span><strong className="font-bold text-slate-900">Secure Storage:</strong> Store backup files in a secure location (external drive, cloud storage)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-black mt-0.5">•</span>
                          <span><strong className="font-bold text-slate-900">Multiple Copies:</strong> Keep at least 2-3 backup copies in different locations</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-black mt-0.5">•</span>
                          <span><strong className="font-bold text-slate-900">Test Recovery:</strong> Periodically verify that backup files can be opened and read</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeSection === 'reports' && (
            <Reports
              activeTab={activeSection}
              contributions={contributions}
              payouts={payouts}
              stats={stats}
            />
          )}

          {activeSection === 'settings' && (
            <Settings
              systemSettings={systemSettings}
              setSystemSettings={setSystemSettings}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onAddMember={handleAddMember}
      />

      <AddContributionModal
        isOpen={isAddContributionOpen}
        onClose={() => setIsAddContributionOpen(false)}
        onRecordContribution={handleRecordContribution}
        members={members}
      />

      <AddPayoutModal
        isOpen={isAddPayoutOpen}
        onClose={() => setIsAddPayoutOpen(false)}
        onRecordPayout={handleRecordPayout}
        members={members}
      />

      <SendSMSModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        onSendSMS={handleSendSMS}
        smsData={smsData}
        setSmsData={setSmsData}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminPortal;