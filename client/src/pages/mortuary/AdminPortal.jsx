import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Users, FileText,
  BarChart3, LayoutGrid, Menu, LogOut, HeartHandshake, Banknote, ClipboardCheck,
} from 'lucide-react';
import {
  Dashboard,
  MemberManagement,
  Reports,
  Claims,
  Beneficiaries,
  DeductionSettings,
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

const SidebarItem = ({ id, icon: Icon, label, activeTab, collapsed, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={label}
    aria-current={activeTab === id ? 'page' : undefined}
    className={`w-full flex items-center gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50 focus-visible:ring-inset ${
      collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
    } ${
      activeTab === id
        ? 'bg-coop-green text-white'
        : 'text-slate-500 hover:bg-slate-50 hover:text-coop-green'
    }`}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
  </button>
);

const AdminPortal = ({ onBack, user }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('mortuaryAdminSidebarCollapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.localStorage.setItem('mortuaryAdminSidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [membersRes, contributionsRes, payoutsRes, dashboardRes, balancesRes] = await Promise.all([
        mortuaryMemberAPI.getAllMembers({ limit: 100 }),
        contributionAPI.getAllContributions(),
        payoutAPI.getAllPayouts(),
        treasurerAPI.getDashboard().catch(() => null),
        treasurerAPI.getAllMemberBalances().catch(() => null)
      ]);

      if (membersRes.members) {
        const membersWithBalances = membersRes.members.map(member => {
          const balanceData = balancesRes?.data?.members?.find(b => b.memberId === member.id);
          return {
            ...member,
            memberId: member.id,
            currentBalance: balanceData?.balance || 0
          };
        });
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

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'claims', label: 'Claims', icon: ClipboardCheck },
    { id: 'beneficiaries', label: 'Beneficiaries', icon: HeartHandshake },
    { id: 'deductionSettings', label: 'Deduction Settings', icon: Banknote },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'backup', label: 'Database Backup', icon: FileText },
  ];

  const filteredMembers = members.filter(member => {
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    const matchesSearch = member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.id?.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const renderContent = () => {
    switch (activeSection) {
      case 'members':
        return (
          <MemberManagement
            filteredMembers={filteredMembers}
            members={members}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setActiveTab={setActiveSection}
          />
        );
      case 'claims':
        return <Claims user={user} />;
      case 'beneficiaries':
        return <Beneficiaries user={user} />;
      case 'deductionSettings':
        return <DeductionSettings user={user} />;
      case 'reports':
        return (
          <Reports
            contributions={contributions}
            stats={stats}
            members={members}
          />
        );
      case 'backup':
        return (
          <div className="space-y-6 pb-12">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Database Backup</h1>
              <p className="text-slate-500 text-sm mt-1">Export and secure your mortuary fund data for emergency recovery.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <Users className="w-5 h-5 text-coop-green" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Members</p>
                  <p className="text-xl font-bold text-slate-900">{members.length}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last Backup</p>
                  <p className="text-xl font-bold text-slate-900">Never</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Data Size</p>
                  <p className="text-xl font-bold text-slate-900">{(JSON.stringify(members).length / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-green-50 rounded-xl shrink-0">
                      <Users className="w-6 h-6 text-coop-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">Members Database</h3>
                      <p className="text-sm text-slate-500 mt-1">Export all member records in CSV format</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-6 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Records</span>
                      <span className="font-semibold text-slate-900">{members.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Format</span>
                      <span className="font-semibold text-slate-900">CSV</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-coop-green hover:bg-coop-darkGreen text-white font-semibold"
                    onClick={() => {
                      const csv = [
                        ['ID', 'Name', 'Email', 'Phone', 'Barangay', 'Address', 'Status', 'Join Date'].join(','),
                        ...members.map(m => [
                          m.id, m.name, m.email || '', m.contact || '', m.barangay || '', m.address || '',
                          m.status, m.join_date || ''
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                      ].join('\n');
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

              <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-blue-50 rounded-xl shrink-0">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">Complete System Backup</h3>
                      <p className="text-sm text-slate-500 mt-1">Full database export in JSON format</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-6 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Members</span>
                      <span className="font-semibold text-slate-900">{members.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Format</span>
                      <span className="font-semibold text-slate-900">JSON</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={() => {
                      const data = {
                        exportDate: new Date().toISOString(),
                        exportVersion: '1.0',
                        system: 'Mortuary Fund Management',
                        members,
                        stats,
                        metadata: {
                          totalMembers: members.length,
                          activeMembers: members.filter(m => m.status === 'active').length,
                          exportedBy: user?.name || 'Admin'
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

            <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden bg-amber-50/40">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-100 rounded-xl shrink-0">
                    <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900 mb-2">Backup Best Practices</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li><span className="font-semibold text-slate-900">Regular Backups:</span> Download backups weekly or after major data changes.</li>
                      <li><span className="font-semibold text-slate-900">Secure Storage:</span> Store backup files in a secure location.</li>
                      <li><span className="font-semibold text-slate-900">Multiple Copies:</span> Keep at least 2-3 backup copies in different locations.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      default:
        return (
          <Dashboard
            stats={stats}
            contributions={contributions}
            payouts={payouts}
            members={members}
            setActiveTab={setActiveSection}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-coop-green rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading mortuary system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-slate-50 flex font-sans text-slate-900 relative overflow-hidden">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Motion.aside
        initial={false}
        animate={{
          width: isDesktop
            ? isSidebarCollapsed ? 68 : 256
            : isMobileMenuOpen ? 256 : 0,
        }}
        transition={{ type: 'tween', duration: 0.2 }}
        className="bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden"
      >
        <div className={`border-b border-slate-100 flex items-center shrink-0 ${isSidebarCollapsed ? 'justify-center py-4' : 'justify-between px-4 py-4'}`}>
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5 min-w-0"
              >
                <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-7 h-7 object-contain shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-slate-900 leading-none truncate">Mortuary Admin</h1>
                  <p className="text-[11px] text-slate-400 mt-0.5">Fund Management</p>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
          {isSidebarCollapsed && (
            <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-6 h-6 object-contain" />
          )}
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto ${isSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-4'}`}>
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              activeTab={activeSection}
              collapsed={isSidebarCollapsed}
              onClick={() => {
                setActiveSection(item.id);
                if (!isDesktop) setIsMobileMenuOpen(false);
              }}
            />
          ))}
        </nav>

        <div className={`border-t border-slate-100 shrink-0 ${isSidebarCollapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 px-1 pb-2">
              <div className="w-8 h-8 bg-coop-green rounded-lg flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-slate-400">Mortuary Admin</p>
              </div>
            </div>
          )}
          {onBack && (
            <button
              onClick={onBack}
              title={isSidebarCollapsed ? 'Sign Out' : undefined}
              aria-label="Sign Out"
              className={`w-full flex items-center gap-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ${isSidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
            </button>
          )}
        </div>

        {isDesktop && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="border-t border-slate-100 py-3 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </Motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-slate-900 text-base tracking-tight">Mortuary Admin</h1>
            <p className="text-slate-400 text-xs font-medium">Fund Management</p>
          </div>
          <div className="w-10 h-10" />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <Motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </Motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminPortal;
