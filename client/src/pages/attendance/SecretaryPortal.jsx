import AttendanceSidebar, { AttendanceMobileBar } from '../../components/attendance/shared/AttendanceSidebar';
import LoadError from '../../components/shared/common/LoadError';
import useUrlState from '../../hooks/useUrlState';
import { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Users,
  Calendar,
  FileText,
  Activity,
} from "lucide-react";
import {
  Dashboard,
  EventManagement,
  MemberManagement,
} from "../../components/attendance/admin";
import { LiveAttendanceList } from "../../components/attendance/shared";
import { memberAPI, eventAPI, attendanceAPI } from "../../services/api";
import { loadDashboardRecords } from "../../utils/attendanceDashboard";


import { AttendanceReports } from "../../components/attendance/secretary";

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

const SecretaryPortal = ({ onBack, user }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.localStorage.getItem("secretarySidebarCollapsed") === "true"
    );
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  /* Kung wala nito, yung mobile nav drawer ay walang keyboard-reachable
  way para isara kung hindi mag-navigate - yung backdrop's onClick lang,
  na hindi ma-trigger ng keyboard-only user. */
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [activeSection, setActiveSection] = useUrlState('tab', 'dashboard', ['dashboard', 'live', 'events', 'members', 'reports', 'directory']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [attendanceRefreshError, setAttendanceRefreshError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // State for data
  const [members, setMembers] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);

  useEffect(() => {
    if (user?.role && !["secretary", "super_admin"].includes(user.role)) {
      alert(
        "This session isn't signed in as a Secretary. Please log in again with a Secretary account.",
      );
      onBack?.();
    }
  }, [user, onBack]);

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

  const fetchAttendanceLogs = useCallback(async () => {
      /* Yung getAllAttendance() lang, naka-cap sa default page size ng
      server (10) - si loadDashboardRecords ang nag-page through sa lahat
      ng record, same fix na ginawa na sa Dashboard/Reports screens ng
      Secretary. Kung wala nito, yung present/absent counts at charts ng
      dashboard ay mali ang count pag lumagpas na ng 10 total scans ang
      event system-wide. */
      const allAttendance = await loadDashboardRecords(attendanceAPI.getAllAttendance, 'attendance');
      return normalizeAttendanceRecords(allAttendance);
  }, []);

  /* Para ma-refresh yung events on demand (bagong Secretary submissions,
  PHT auto status changes, etc.) kahit hindi i-reload yung whole portal. */
  const fetchEvents = useCallback(async () => {
    try {
      const allEvents = await loadDashboardRecords(eventAPI.getEvents, 'events');
      setEvents(allEvents);
    } catch (error) {
      console.error("Error refreshing events:", error);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      /* Kukunin lahat ng data in parallel - yung attendance ay nag-page
      through sa lahat ng record (tignan sa fetchAttendanceLogs sa taas
      kung bakit hindi sapat yung getAllAttendance() lang). */
      const [membersRes, allEvents, allAttendance] = await Promise.all([
        memberAPI.getAllMembers(),
        loadDashboardRecords(eventAPI.getEvents, 'events'),
        loadDashboardRecords(attendanceAPI.getAllAttendance, 'attendance'),
      ]);

      if (membersRes.members) {
        setMembers(membersRes.members);
      }

      setEvents(allEvents);
      // Set first active event as current, or first event.
      const activeEvent = allEvents.find((e) => e.status === "active");
      setCurrentEvent(activeEvent || allEvents[0] || null);

      setAttendanceLogs(normalizeAttendanceRecords(allAttendance));
      setHasLoaded(true);
      setLoadError(null);
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setLoadError('Unable to load attendance records and events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Keep dashboard totals current without replacing the page with a loader.
  useEffect(() => {
    if (loading || !hasLoaded || !["dashboard", "events", "live"].includes(activeSection)) return undefined;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const records = await fetchAttendanceLogs();
        if (!disposed) {
          setAttendanceLogs(records);
          setAttendanceRefreshError(false);
        }
      } catch {
        if (!disposed) setAttendanceRefreshError(true);
      } finally {
        pending = false;
      }
    };
    refresh();
    const refreshInterval = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      clearInterval(refreshInterval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeSection, loading, hasLoaded, fetchAttendanceLogs]);

  // Refresh schedules while the portal is open.
  useEffect(() => {
    if (activeSection === "events") fetchEvents();
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === "visible") fetchEvents();
    }, 10000);
    return () => clearInterval(refreshInterval);
  }, [activeSection, fetchEvents]);

  useEffect(() => {
    const handleWindowFocus = () => {
      fetchEvents();
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [fetchEvents]);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "live", label: "Live Attendance", icon: Activity },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "events", label: "Event Management", icon: Calendar },
    { id: "members", label: "QR Management", icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
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
    <div className="portal-shell attendance-workspace h-dvh flex font-sans relative overflow-hidden">
      <AttendanceSidebar
        items={menuItems}
        activeId={activeSection === "directory" ? "members" : activeSection}
        onSelect={setActiveSection}
        roleLabel="Secretary"
        userName={user?.name}
        onBack={onBack}
        isDesktop={isDesktop}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="attendance-main flex-1 flex flex-col min-w-0" inert={!isDesktop && isMobileMenuOpen ? true : undefined}>
        <AttendanceMobileBar mobileOpen={isMobileMenuOpen} onOpen={() => setIsMobileMenuOpen(true)} />
        <main className="attendance-content flex-1 overflow-y-auto">
          {loadError && <LoadError message={loadError} onRetry={fetchInitialData} retrying={loading} />}
          <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {(!loadError || hasLoaded) && <AnimatePresence mode="wait">
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
                    refreshError={attendanceRefreshError}
                  />
                )}

                {activeSection === "events" && (
                  <EventManagement
                    user={user}
                    events={events}
                    setEvents={setEvents}
                    attendanceLogs={attendanceLogs}
                    setActiveTab={setActiveSection}
                    setCurrentEvent={setCurrentEvent}
                  />
                )}

                {activeSection === "reports" && <AttendanceReports user={user} attendanceLogs={attendanceLogs} events={events} />}
                {["members", "directory"].includes(activeSection) && <MemberManagement />}

                {activeSection === "live" && (
                  <LiveAttendanceList
                    variant="admin"
                    attendanceLogs={attendanceLogs}
                    events={events}
                    currentEvent={currentEvent}
                  />
                )}



              </Motion.div>
            </AnimatePresence>}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SecretaryPortal;
