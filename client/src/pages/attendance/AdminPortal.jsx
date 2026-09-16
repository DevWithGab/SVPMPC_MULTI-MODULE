import React, { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Users,
  Calendar,
  BarChart3,
  FileText,
  Activity,
  Shield,
  Menu,
  LogOut,
} from "lucide-react";
import {
  Dashboard,
  EventManagement,
  MemberManagement,
  Reports,
  AuditLogs,
  DatabaseBackup,
} from "../../components/attendance/admin";
import { LiveAttendanceList } from "../../components/attendance/shared";
import { memberAPI, eventAPI, attendanceAPI } from "../../services/api";

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

const normalizeAttendanceRecord = (record) => ({
  ...record,
  memberId: record.memberId || record.member_id,
  eventId: record.eventId || record.event_id,
  memberName:
    record.memberName ||
    record.member_name ||
    record.member?.memberName ||
    record.member?.member_name,
  eventName:
    record.eventName ||
    record.event ||
    record.event?.eventName ||
    record.event?.name,
  scanTime:
    record.scanTime || record.timestamp || record.createdAt || record.date,
});

const normalizeAttendanceRecords = (records = []) =>
  records.map((record) => normalizeAttendanceRecord(record));

const AdminPortal = ({ onBack, user }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("attendanceAdminSidebarCollapsed") === "true"
    );
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // State for data
  const [members, setMembers] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    if (user?.role && !["admin", "super_admin"].includes(user.role)) {
      alert(
        "This session isn't signed in as an Admin. Please log in again with an Admin account.",
      );
      onBack?.();
    }
  }, [user, onBack]);

  useEffect(() => {
    window.localStorage.setItem(
      "attendanceAdminSidebarCollapsed",
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchAttendanceLogs = useCallback(async () => {
    try {
      const attendanceRes = await attendanceAPI.getAllAttendance();
      if (attendanceRes.attendance) {
        setAttendanceLogs(normalizeAttendanceRecords(attendanceRes.attendance));
      }
    } catch (error) {
      console.error("Error refreshing attendance logs:", error);
    }
  }, []);

  // Refresh events on demand (new Secretary submissions, PHT auto status
  // changes, etc.) without reloading the whole portal.
  const fetchEvents = useCallback(async () => {
    try {
      const eventsRes = await eventAPI.getAllEvents();
      if (eventsRes.events) {
        setEvents(eventsRes.events);
      }
    } catch (error) {
      console.error("Error refreshing events:", error);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [membersRes, eventsRes, attendanceRes] = await Promise.all([
        memberAPI.getAllMembers(),
        eventAPI.getAllEvents(),
        attendanceAPI.getAllAttendance(),
      ]);

      if (membersRes.members) {
        setMembers(membersRes.members);
      }

      if (eventsRes.events) {
        setEvents(eventsRes.events);
        // Set first active event as current, or first event
        const activeEvent = eventsRes.events.find((e) => e.status === "active");
        setCurrentEvent(activeEvent || eventsRes.events[0] || null);
      }

      if (attendanceRes.attendance) {
        setAttendanceLogs(normalizeAttendanceRecords(attendanceRes.attendance));
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchAttendanceLogs();
    }, 7000);

    return () => clearInterval(refreshInterval);
  }, [fetchAttendanceLogs]);

  // Keep the Event Approvals tab current: pick up new Secretary
  // submissions right away, then poll while the tab stays open so approvals
  // and the automatic Upcoming/Active/Close transitions show up without a
  // manual page reload.
  useEffect(() => {
    if (activeSection !== "events") return undefined;
    fetchEvents();
    const refreshInterval = setInterval(fetchEvents, 10000);
    return () => clearInterval(refreshInterval);
  }, [activeSection, fetchEvents]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (activeSection === "events") {
        fetchEvents();
      }
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [activeSection, fetchEvents]);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "live", label: "Live Attendance", icon: Activity },
    { id: "events", label: "Event Approvals", icon: Calendar },
    { id: "members", label: "Member QR Management", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "auditlogs", label: "Audit Logs", icon: Shield },
    { id: "backup", label: "Backup & Restore", icon: FileText },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-coop-green rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            Loading attendance system...
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
                  ATTENDANCE SYSTEM
                </p>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-y-auto ${isSidebarCollapsed ? "px-2.5 py-4" : "px-3 py-4"}`}
        >
          {menuItems.map((item) => (
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
              Attendance Admin
            </h1>
            <p className="text-green-100/60 text-xs font-medium">
              System Management
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
                {activeSection === "dashboard" && (
                  <Dashboard
                    members={members}
                    setMembers={setMembers}
                    attendanceLogs={attendanceLogs}
                    setAttendanceLogs={setAttendanceLogs}
                    events={events}
                    setEvents={setEvents}
                    currentEvent={currentEvent}
                    setCurrentEvent={setCurrentEvent}
                    setActiveSection={setActiveSection}
                  />
                )}

                {activeSection === "events" && (
                  <EventManagement
                    events={events}
                    setEvents={setEvents}
                    attendanceLogs={attendanceLogs}
                    setActiveTab={setActiveSection}
                    setCurrentEvent={setCurrentEvent}
                  />
                )}

                {activeSection === "members" && <MemberManagement />}

                {activeSection === "live" && (
                  <LiveAttendanceList
                    attendanceLogs={attendanceLogs}
                    events={events}
                    currentEvent={currentEvent}
                  />
                )}

                {activeSection === "reports" && <Reports events={events} />}

                {activeSection === "auditlogs" && <AuditLogs />}

                {activeSection === "backup" && (
                  <DatabaseBackup
                    members={members}
                    events={events}
                    attendanceLogs={attendanceLogs}
                    onRestored={fetchInitialData}
                  />
                )}
              </Motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;
