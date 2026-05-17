import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Users, FileText, 
  BarChart3, LayoutGrid
} from 'lucide-react';
import { 
  Dashboard, 
  MemberManagement, 
  Reports
} from '../../components/mortuary/admin';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ToastContainer, useToast } from '../../components/ui/toast';
import { 
  contributionAPI, 
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

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel - use mortuary-specific endpoints
      const [membersRes, contributionsRes, payoutsRes, dashboardRes, balancesRes] = await Promise.all([
        mortuaryMemberAPI.getAllMembers(), // Use mortuaryMemberAPI
        contributionAPI.getAllContributions(),
        payoutAPI.getAllPayouts(),
        treasurerAPI.getDashboard().catch(() => null), // Don't fail if dashboard fails
        treasurerAPI.getAllMemberBalances().catch(() => null) // Fetch member balances
      ]);

      console.log('Members Response:', membersRes);
      console.log('Contributions Response:', contributionsRes);
      console.log('Balances Response:', balancesRes);

      if (membersRes.members) {
        // Merge member data with their balances
        const membersWithBalances = membersRes.members.map(member => {
          // Admin API returns 'id' field, balance API uses 'memberId'
          const balanceData = balancesRes?.data?.members?.find(b => b.memberId === member.id);
          console.log(`Member ${member.id} (${member.name}) - Balance Data:`, balanceData);
          return {
            ...member,
            memberId: member.id, // Ensure memberId is set for consistency
            currentBalance: balanceData?.balance || 0
          };
        });
        console.log('Members with Balances:', membersWithBalances);
        setMembers(membersWithBalances);
      }

      if (contributionsRes.data) {
        setContributions(contributionsRes.data);
      }

      if (payoutsRes.payouts) {
        setPayouts(payoutsRes.payouts);
      }
      
      if (dashboardRes && dashboardRes.data) {
        setStats({
          fundBalance: dashboardRes.data.fundBalance || 0,
          activeMembers: dashboardRes.data.activeMembers || 0,
          totalMembers: dashboardRes.data.totalMembers || 0,
          lowBalanceMembers: dashboardRes.data.lowBalanceMembers || 0,
          totalCollected: dashboardRes.data.totalCollected || 0,
        });
      } else {
        setStats({
          fundBalance: 0,
          activeMembers: membersRes.members?.length || 0,
          totalMembers: membersRes.members?.length || 0,
          lowBalanceMembers: 0,
          totalCollected: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      // Set fallback data
      setStats({
        fundBalance: 0,
        activeMembers: members.length,
        totalMembers: members.length,
        lowBalanceMembers: 0,
        totalCollected: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'backup', label: 'Database Backup', icon: FileText },
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
          <div className="w-16 h-16 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading mortuary system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`bg-white shadow-lg transition-all duration-300 relative flex flex-col ${sidebarCollapsed ? "w-16" : "w-64"}`}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-100">
                  <img
                    src="/SVPMPC-LOGO(MAIN).png"
                    alt="SVMPC Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: "#2D7A3E" }}
                  >
                    Mortuary Admin
                  </h2>
                  <p className="text-sm text-gray-600 font-medium">Fund Management</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-100">
                <img
                  src="/SVPMPC-LOGO(MAIN).png"
                  alt="SVMPC Logo"
                  className="w-8 h-8 object-contain"
                />
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
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
                    ? "border-r-2 text-white"
                    : "text-gray-700"
                }`}
                style={
                  activeSection === item.id
                    ? {
                        backgroundColor: "#2D7A3E",
                        borderRightColor: "#F2E416",
                      }
                    : {}
                }
              >
                <Icon size={20} className="flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
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
        <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
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
            />
          )}

          {activeSection === 'backup' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#2D7A3E" }}>Database Backup</h2>
                  <p className="text-gray-600 font-medium">Export and secure your mortuary fund data for emergency recovery</p>
                </div>
              </div>

              {/* Backup Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <Users className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Members</p>
                    <p className="text-xl font-bold text-gray-900">{members.length}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <FileText className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Backup</p>
                    <p className="text-xl font-bold text-gray-900">Never</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <BarChart3 className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Data Size</p>
                    <p className="text-xl font-bold text-gray-900">{(JSON.stringify(members).length / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              </div>

              {/* Backup Options */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Members CSV Backup */}
                <Card className="border-gray-200 shadow-sm">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-emerald-50 rounded-xl flex-shrink-0">
                        <Users className="w-6 h-6 text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">Members Database</h3>
                        <p className="text-sm text-gray-600 font-medium mt-1">Export all member records in CSV format</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Total Records</span>
                        <span className="font-bold text-gray-900">{members.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Format</span>
                        <span className="font-bold text-gray-900">CSV</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Includes</span>
                        <span className="font-bold text-gray-900">All Fields</span>
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
                <Card className="border-gray-200 shadow-sm">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
                        <BarChart3 className="w-6 h-6 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900">Complete System Backup</h3>
                        <p className="text-sm text-gray-600 font-medium mt-1">Full database export in JSON format</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Members</span>
                        <span className="font-bold text-gray-900">{members.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Format</span>
                        <span className="font-bold text-gray-900">JSON</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 font-medium">Includes</span>
                        <span className="font-bold text-gray-900">All Data + Stats</span>
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
              <Card className="border-gray-200 shadow-sm bg-amber-50/30">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Backup Best Practices</h3>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span><strong className="font-bold text-gray-900">Regular Backups:</strong> Download backups weekly or after major data changes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span><strong className="font-bold text-gray-900">Secure Storage:</strong> Store backup files in a secure location (external drive, cloud storage)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span><strong className="font-bold text-gray-900">Multiple Copies:</strong> Keep at least 2-3 backup copies in different locations</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold mt-0.5">•</span>
                          <span><strong className="font-bold text-gray-900">Test Recovery:</strong> Periodically verify that backup files can be opened and read</span>
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
              members={members}
            />
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminPortal;