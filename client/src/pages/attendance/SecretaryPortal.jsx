import React, { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Calendar,
  Users,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  UserCheck,
  BarChart3,
  Activity,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useAttendance } from "../../hooks/useAttendance";
import { attendanceAPI } from "../../services/api";

// Import the attendance secretary components
import {
  Dashboard,
  EventManagement,
  AttendanceReports,
  MemberDirectory,
  ManualAttendance,
} from "../../components/attendance/secretary";
import { LiveAttendanceList } from "../../components/attendance/shared";

const SidebarItem = ({ id, icon: Icon, label, activeTab, collapsed, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={label}
    aria-current={activeTab === id ? "page" : undefined}
    className={`w-full flex items-center gap-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50 focus-visible:ring-inset ${
      collapsed ? "justify-center px-0 py-3" : "px-4 py-3"
    } ${
      activeTab === id
        ? "bg-coop-green text-white"
        : "text-slate-500 hover:bg-slate-50 hover:text-coop-green"
    }`}
  >
    <Icon className="w-5 h-5 shrink-0" />
    {!collapsed && <span className="text-sm font-semibold tracking-tight">{label}</span>}
  </button>
);

export default function AttendanceSecretaryPortal({
  onBack,
  user: propUser,
  token: propToken,
}) {
  const { user, updateAuth } = useAuth();

  // Use props if provided, otherwise use context
  const currentUser = propUser || user;

  // Update context if props are provided
  useEffect(() => {
    if (propUser && propToken) {
      updateAuth(propUser, propToken);
    }
  }, [propUser, propToken, updateAuth]);

  const { attendanceLogs, events, refreshData } = useAttendance();

  const [allAttendance, setAllAttendance] = useState([]);

  const refreshAllAttendance = useCallback(async () => {
    try {
      const response = await attendanceAPI.getAllAttendance();
      const fetched = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : response?.attendance || response?.data?.attendance || [];
      setAllAttendance(fetched);
    } catch (error) {
      console.error("Error fetching all attendance:", error);
      setAllAttendance([]);
    }
  }, []);

  useEffect(() => {
    refreshAllAttendance();
  }, [refreshAllAttendance]);

  const [activeTab, setActiveTab] = useState("home");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("secretarySidebarCollapsed") === "true";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    window.localStorage.setItem(
      "secretarySidebarCollapsed",
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (activeTab === "events") {
      refreshData();
    }
  }, [activeTab, refreshData]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeTab === "events") {
        refreshData();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [activeTab, refreshData]);

  const sidebarItems = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "events", label: "Event Management", icon: Calendar },
    { id: "reports", label: "Attendance Reports", icon: BarChart3 },
    { id: "live", label: "Live Attendance", icon: Activity },
    { id: "manual", label: "Manual Attendance", icon: UserCheck },
    { id: "directory", label: "Member Directory", icon: Users },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "events":
        return (
          <EventManagement
            user={currentUser}
            events={events}
            onRefreshEvents={refreshData}
          />
        );

      case "reports":
        return (
          <AttendanceReports
            user={currentUser}
            attendanceLogs={attendanceLogs}
            events={events}
          />
        );

      case "manual":
        return (
          <ManualAttendance
            user={currentUser}
            events={events}
            onAttendanceRecorded={refreshAllAttendance}
          />
        );

      case "directory":
        return <MemberDirectory user={currentUser} />;

      case "live":
        return (
          <LiveAttendanceList
            attendanceLogs={allAttendance}
            events={events}
            onRefresh={refreshAllAttendance}
          />
        );

      default: // 'home'
        return (
          <Dashboard
            user={currentUser}
            attendanceLogs={attendanceLogs}
            events={events}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="h-dvh bg-slate-50 flex font-sans text-slate-900 relative overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Motion.aside
        initial={false}
        animate={{
          width: isDesktop
            ? isSidebarCollapsed
              ? 68
              : 256
            : isMobileMenuOpen
              ? 256
              : 0,
        }}
        transition={{ type: "tween", duration: 0.2 }}
        className="bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden"
      >
        <div
          className={`border-b border-slate-100 flex items-center shrink-0 ${
            isSidebarCollapsed ? "justify-center py-4" : "justify-between px-4 py-4"
          }`}
        >
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <Motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5 min-w-0"
              >
                <img
                  src="/SVPMPC-LOGO(MAIN).png"
                  alt="SVMPC Logo"
                  className="w-7 h-7 object-contain shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-slate-900 leading-none truncate">
                    Secretary
                  </h1>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Attendance System
                  </p>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>

          {isSidebarCollapsed && (
            <img
              src="/SVPMPC-LOGO(MAIN).png"
              alt="SVMPC Logo"
              className="w-6 h-6 object-contain"
            />
          )}
        </div>

        {/* Navigation */}
        <nav
          className={`flex-1 space-y-1 ${isSidebarCollapsed ? "px-2 py-3" : "px-3 py-4"}`}
        >
          {sidebarItems.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              icon={item.icon}
              label={item.label}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              collapsed={isSidebarCollapsed}
              onClick={() => {
                setActiveTab(item.id);
                if (!isDesktop) setIsMobileMenuOpen(false);
              }}
            />
          ))}
        </nav>

        {/* User Profile Section */}
        <div
          className={`border-t border-slate-100 shrink-0 ${
            isSidebarCollapsed ? "px-2 py-3" : "px-3 py-3"
          }`}
        >
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 px-1 pb-2">
              <div className="w-8 h-8 bg-coop-green rounded-lg flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {currentUser?.name || "Secretary"}
                </p>
                <p className="text-[11px] text-slate-400">Secretary Role</p>
              </div>
            </div>
          )}

          <button
            onClick={onBack}
            title={isSidebarCollapsed ? "Logout" : undefined}
            aria-label="Logout"
            className={`w-full flex items-center gap-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-inset ${
              isSidebarCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-sm font-medium">Sign Out</span>
            )}
          </button>
        </div>

        {/* Collapse Toggle (desktop only) */}
        {isDesktop && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="border-t border-slate-100 py-3 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50 focus-visible:ring-inset shrink-0"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </Motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green/50"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-slate-900 text-base tracking-tight">
              Secretary Portal
            </h1>
            <p className="text-slate-400 text-xs font-medium">
              Attendance System
            </p>
          </div>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <Motion.div
                key={activeTab}
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
    </div>
  );
}
