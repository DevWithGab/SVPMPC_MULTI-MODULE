import LoadError from '../../components/shared/common/LoadError';
import { loadAllPages } from '../../utils/loadAllPages';
import useUrlState from '../../hooks/useUrlState';
import './TreasurerPortal.css';
import React, { useState, useEffect } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Users,
  Menu,
  LogOut,
  HeartHandshake,
  ClipboardCheck,
  UserRound,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Dashboard,
  MemberManagement,
  Claims,
  Beneficiaries,
} from "../../components/mortuary/admin";
import { ToastContainer, useToast } from "../../components/ui/toast";
import {
  contributionAPI,
  mortuaryDashboardAPI,
  mortuaryMemberAPI,
} from "../../services/api";

const SidebarItem = ({
  id,
  icon,
  label,
  activeTab,
  collapsed,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={label}
    aria-current={activeTab === id ? "page" : undefined}
    className={`mt-nav-item ${collapsed ? 'mt-nav-item-collapsed' : ''}`}
  >
    {React.createElement(icon, { className: 'w-4.5 h-4.5 shrink-0', 'aria-hidden': true })}
    {!collapsed && (
      <span className="text-sm font-semibold tracking-tight">{label}</span>
    )}
  </button>
);

const AdminPortal = ({ onBack, user }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("mortuaryAdminSidebarCollapsed") === "true"
    );
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /* Kung wala nito, yung mobile nav drawer ay walang keyboard-reachable
  way para isara kung hindi mag-navigate - yung backdrop's onClick lang,
  na hindi ma-trigger ng keyboard-only user. */
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => document.querySelector('#mortuary-admin-navigation .mt-close-menu')?.focus());
    const onKeyDown = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); cancelAnimationFrame(frame); previousFocus?.focus(); };
  }, [isMobileMenuOpen]);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [activeSection, setActiveSection] = useUrlState('tab', 'dashboard', ['dashboard', 'members', 'claims', 'beneficiaries']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");


  useEffect(() => {
    window.localStorage.setItem(
      "mortuaryAdminSidebarCollapsed",
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [
        membersRes,
        contributionsRes,
        dashboardRes,
        balancesRes,
      ] = await Promise.all([
        loadAllPages(page => mortuaryMemberAPI.getAllMembers({ page, limit: 100 })).then(members => ({ success: true, members })),
        contributionAPI.getAllContributions(),
        mortuaryDashboardAPI.getFundOverview(),
        mortuaryDashboardAPI.getBalances(),
      ]);

      if (!dashboardRes?.data || !balancesRes?.data || [membersRes, contributionsRes, dashboardRes, balancesRes].some(result => result?.success === false)) {
        throw new Error('Incomplete mortuary response');
      }
      if (membersRes.members) {
        const membersWithBalances = membersRes.members.map((member) => {
          const balanceData = balancesRes?.data?.members?.find(
            (b) => b.memberId === member.id,
          );
          return {
            ...member,
            memberId: member.id,
            currentBalance: balanceData?.balance || 0,
          };
        });
        setMembers(membersWithBalances);
      }

      if (contributionsRes.data) {
        setContributions(contributionsRes.data);
      }


      if (dashboardRes && dashboardRes.data) {
        setStats({
          fundBalance: dashboardRes.data.fundBalance || 0,
          activeMembers: dashboardRes.data.activeMembers || 0,
          totalMembers: dashboardRes.data.totalMembers || 0,
          lowBalanceMembers: dashboardRes.data.lowBalanceMembers || 0,
          minimumBalance: dashboardRes.data.minimumBalance ?? 1000,
          totalCollected: dashboardRes.data.totalCollected || 0,
        });
      }
      setHasLoaded(true);
      setLoadError(null);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoadError('Unable to load mortuary records and totals.');
    } finally {
      setLoading(false);
    }
  };

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "members", label: "Members", icon: Users },
    { id: "claims", label: "Claims", icon: ClipboardCheck },
    { id: "beneficiaries", label: "Beneficiaries", icon: HeartHandshake },
  ];


  const filteredMembers = members.filter((member) => {
    const matchesStatus =
      statusFilter === "all" || member.status === statusFilter;
    const matchesSearch =
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.id?.toString().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const renderContent = () => {
    switch (activeSection) {
      case "members":
        return (
          <MemberManagement
            minimumBalance={stats?.minimumBalance}
            filteredMembers={filteredMembers}
            members={members}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setActiveTab={setActiveSection}
            onMemberAdded={fetchInitialData}
          />
        );
      case "claims":
        return <Claims user={user} />;
      case "beneficiaries":
        return <Beneficiaries user={user} />;
      default:
        return (
          <Dashboard
            stats={stats}
            contributions={contributions}
            members={members}
            setActiveTab={setActiveSection}
            user={user}
            showToast={addToast}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-coop-green rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            Loading mortuary system...
          </p>
        </div>
      </div>
    );
  }

  const navigationCollapsed = isDesktop && isSidebarCollapsed;

  return (
    <div className="mortuary-treasurer-portal mortuary-admin-portal h-full flex font-sans relative overflow-hidden">
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
            ? isSidebarCollapsed
              ? 76
              : 296
            : isMobileMenuOpen
              ? 296
              : 0,
        }}
        transition={{ type: "tween", duration: 0.2 }}
        className="mt-sidebar flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden print:hidden"
        id="mortuary-admin-navigation"
        aria-label="Mortuary navigation"
        aria-hidden={!isDesktop && !isMobileMenuOpen ? true : undefined}
        inert={!isDesktop && !isMobileMenuOpen ? true : undefined}
      >
        <div
          className={`mt-brand ${navigationCollapsed ? 'mt-brand-collapsed' : ''}`}
        >
          <img
            src="/SVPMPC-LOGO(MAIN).png"
            alt="SVPMPC Logo"
            className="mt-brand-logo"
          />
          <AnimatePresence mode="wait">
            {!navigationCollapsed && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <p className="mt-brand-name">SVPMPC</p>
                <p className="mt-brand-description">Saint Vincent Parish<br />Multi-Purpose Cooperative</p>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {!navigationCollapsed && <p className="mt-nav-label">Mortuary management</p>}
        {!isDesktop && <button className="mt-close-menu" aria-label="Close menu" onClick={() => setIsMobileMenuOpen(false)}><X size={20} aria-hidden="true" /></button>}

        <nav
          className="mt-nav"
          aria-label="Claims Officer workspace"
        >
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              activeTab={activeSection}
              collapsed={navigationCollapsed}
              onClick={() => {
                setActiveSection(item.id);
                if (!isDesktop) setIsMobileMenuOpen(false);
              }}
            />
          ))}
        </nav>

        <div className="mt-account">
          {!navigationCollapsed ? <details>
            <summary><UserRound size={26} aria-hidden="true" /><span>Claims Officer</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="mt-account-details"><p>{user?.name || 'Claims Officer'}</p>{onBack && <button onClick={onBack} aria-label="Sign Out"><LogOut size={18} aria-hidden="true" />Sign Out</button>}</div>
          </details> : onBack && <button onClick={onBack} aria-label="Sign Out" title="Sign Out"><LogOut size={20} aria-hidden="true" /></button>}
        </div>

        {isDesktop && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={
              isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="mt-collapse"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </Motion.aside>

      <div className="flex-1 flex flex-col min-w-0" inert={!isDesktop && isMobileMenuOpen ? true : undefined}>
        <div className="mt-mobile-bar lg:hidden flex items-center justify-between shrink-0 print:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mortuary-admin-navigation"
            className="mt-menu-button"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-base">SVPMPC</p>
            <p className="text-xs">Mortuary management</p>
          </div>
          <div className="w-10 h-10" />
        </div>

        <main className="mt-main flex-1 overflow-y-auto" data-view={activeSection}>
          {loadError && <LoadError message={loadError} onRetry={fetchInitialData} retrying={loading} />}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <Motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {(!loadError || hasLoaded) && renderContent()}
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
