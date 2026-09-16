import React, { useState, useEffect } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  BarChart3,
  LayoutGrid,
  Menu,
  LogOut,
  HeartHandshake,
  Banknote,
  ClipboardCheck,
  Shield,
} from "lucide-react";
import {
  Dashboard,
  MemberManagement,
  Reports,
  Claims,
  Beneficiaries,
  DeductionSettings,
  AuditLogs,
  DatabaseBackup,
} from "../../components/mortuary/admin";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ToastContainer, useToast } from "../../components/ui/toast";
import {
  contributionAPI,
  treasurerAPI,
  payoutAPI,
  mortuaryMemberAPI,
} from "../../services/api";

const SidebarItem = ({
  id,
  icon: Icon,
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
    className={`w-full flex items-center gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset ${
      collapsed ? "justify-center px-0 py-3" : "px-4 py-2.5"
    } ${
      activeTab === id
        ? "bg-white text-coop-darkGreen shadow-sm"
        : "text-green-100/80 hover:bg-white/10 hover:text-white"
    }`}
  >
    <Icon className="w-4.5 h-4.5 shrink-0" />
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
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();

  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);
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
        payoutsRes,
        dashboardRes,
        balancesRes,
      ] = await Promise.all([
        mortuaryMemberAPI.getAllMembers({ limit: 100 }),
        contributionAPI.getAllContributions(),
        payoutAPI.getAllPayouts(),
        treasurerAPI.getDashboard().catch(() => null),
        treasurerAPI.getAllMemberBalances().catch(() => null),
      ]);

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
      console.error("Error fetching initial data:", error);
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
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "members", label: "Members", icon: Users },
    { id: "claims", label: "Claims", icon: ClipboardCheck },
    { id: "beneficiaries", label: "Beneficiaries", icon: HeartHandshake },
    { id: "deductionSettings", label: "Deduction Settings", icon: Banknote },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "auditlogs", label: "Audit Logs", icon: Shield },
    { id: "backup", label: "Backup & Restore", icon: FileText },
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
            filteredMembers={filteredMembers}
            members={members}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setActiveTab={setActiveSection}
          />
        );
      case "claims":
        return <Claims user={user} />;
      case "beneficiaries":
        return <Beneficiaries user={user} />;
      case "deductionSettings":
        return <DeductionSettings user={user} />;
      case "reports":
        return (
          <Reports
            contributions={contributions}
            stats={stats}
            members={members}
          />
        );
      case "auditlogs":
        return <AuditLogs />;
      case "backup":
        return (
          <DatabaseBackup
            members={members}
            contributions={contributions}
            user={user}
            onRestored={fetchInitialData}
          />
        );
      default:
        return (
          <Dashboard
            stats={stats}
            contributions={contributions}
            payouts={payouts}
            members={members}
            setActiveTab={setActiveSection}
            user={user}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-coop-green rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            Loading mortuary system...
          </p>
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
            ? isSidebarCollapsed
              ? 76
              : 268
            : isMobileMenuOpen
              ? 268
              : 0,
        }}
        transition={{ type: "tween", duration: 0.2 }}
        className="bg-coop-darkGreen flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden"
      >
        <div
          className={`border-b border-white/10 flex items-center shrink-0 ${isSidebarCollapsed ? "justify-center py-5" : "gap-3 px-5 py-5"}`}
        >
          <img
            src="/SVPMPC-LOGO(MAIN).png"
            alt="SVPMPC Logo"
            className={`object-contain shrink-0 ${isSidebarCollapsed ? "w-8 h-8" : "w-10 h-10"}`}
          />
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <h1 className="text-sm font-bold text-white leading-tight truncate">
                  St. Vincent Parish
                </h1>
                <p className="text-[11px] text-green-100/70 leading-tight truncate">
                  Multi-Purpose Cooperative
                </p>
                <p className="text-[10px] font-bold text-coop-yellow tracking-wider mt-1">
                  MORTUARY FUND SYSTEM
                </p>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-y-auto ${isSidebarCollapsed ? "px-2.5 py-4" : "px-3 py-4"}`}
        >
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

        <div
          className={`border-t border-white/10 shrink-0 ${isSidebarCollapsed ? "px-2.5 py-3" : "px-3 py-3"}`}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 px-1 pb-2">
              <div className="w-9 h-9 bg-white/10 border border-white/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">
                  {(user?.name || "Admin").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.name || "Admin User"}
                </p>
                <p className="text-[11px] text-green-100/60">
                  System Administrator
                </p>
              </div>
            </div>
          )}
          {onBack && (
            <button
              onClick={onBack}
              title={isSidebarCollapsed ? "Sign Out" : undefined}
              aria-label="Sign Out"
              className={`w-full flex items-center gap-3 text-green-100/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${isSidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="text-sm font-medium">Sign Out</span>
              )}
            </button>
          )}
        </div>

        {isDesktop && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={
              isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="border-t border-white/10 py-3 flex items-center justify-center text-green-100/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </Motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden bg-coop-darkGreen p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-white text-base tracking-tight">
              Mortuary Admin
            </h1>
            <p className="text-green-100/60 text-xs font-medium">
              Fund Management
            </p>
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
