import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Users, CreditCard, FileText, 
  Banknote, BarChart3, Settings, UserCheck, LayoutGrid
} from 'lucide-react';
import { 
  Dashboard, 
  MemberManagement, 
  Contributions, 
  Claims, 
  Payouts,
  ProfileUpdates,
  Settings as SettingsView,
  Reports
} from '../../components/mortuary/admin';
import { 
  memberAPI, 
  contributionAPI, 
  claimAPI, 
  mortuaryDashboardAPI 
} from '../../services/api';

const AdminPortal = ({ onBack }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // State for data
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [profileUpdates, setProfileUpdates] = useState([]);
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
      // Fetch all data in parallel
      const [membersRes, contributionsRes] = await Promise.all([
        memberAPI.getAllMembers(),
        contributionAPI.getAllContributions()
      ]);

      if (membersRes.members) {
        setMembers(membersRes.members);
      }

      if (contributionsRes.contributions) {
        setContributions(contributionsRes.contributions);
      }

      // Mock data for now - replace with actual API calls
      setClaims([]);
      setPayouts([]);
      setProfileUpdates([]);
      setStats({
        fundBalance: 75000,
        activeMembers: membersRes.members?.length || 0,
        totalPayouts: 0,
      });
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateClaimStatus = async (claimId, newStatus) => {
    // TODO: Implement claim status update
    console.log('Update claim status:', claimId, newStatus);
  };

  const updateProfileStatus = async (id, status) => {
    // TODO: Implement profile update status
    console.log('Update profile status:', id, status);
  };

  const showToast = (message, type) => {
    // TODO: Implement toast notification
    console.log('Toast:', message, type);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'contributions', label: 'Contributions', icon: CreditCard },
    { id: 'claims', label: 'Claims', icon: FileText },
    { id: 'payouts', label: 'Payouts', icon: Banknote },
    { id: 'profiles', label: 'Profile Updates', icon: UserCheck },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
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
            />
          )}

          {activeSection === 'contributions' && (
            <Contributions
              contributions={contributions}
              contributionSearch={contributionSearch}
              setContributionSearch={setContributionSearch}
              contributionStatusFilter={contributionStatusFilter}
              setContributionStatusFilter={setContributionStatusFilter}
              setIsAddContributionOpen={setIsAddContributionOpen}
            />
          )}

          {activeSection === 'claims' && (
            <Claims
              claims={claims}
              updateClaimStatus={updateClaimStatus}
            />
          )}

          {activeSection === 'payouts' && (
            <Payouts
              payouts={payouts}
              setIsAddPayoutOpen={setIsAddPayoutOpen}
            />
          )}

          {activeSection === 'profiles' && (
            <ProfileUpdates
              profileUpdates={profileUpdates}
              updateProfileStatus={updateProfileStatus}
            />
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
            <SettingsView
              systemSettings={systemSettings}
              setSystemSettings={setSystemSettings}
              showToast={showToast}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;