import AttendanceSidebar, { AttendanceMobileBar } from '../../components/attendance/shared/AttendanceSidebar';
import LoadError from '../../components/shared/common/LoadError';
import useUrlState from '../../hooks/useUrlState';
import { useState, useEffect, useCallback } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Calendar,
  Users,
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
} from "../../components/attendance/secretary";
import { LiveAttendanceList } from "../../components/attendance/shared";


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

  
  useEffect(() => {
    if (
      currentUser?.role &&
      !["secretary", "admin"].includes(currentUser.role)
    ) {
      alert(
        "This session isn't signed in as Secretary. Please log in again with a Secretary account.",
      );
      onBack?.();
    }
  }, [currentUser, onBack]);

  const { attendanceLogs, events, refreshData, loadError, loading, hasLoaded } = useAttendance();

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

  const [activeTab, setActiveTab] = useUrlState('tab', 'home', ['home', 'events', 'reports', 'live', 'directory']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("secretarySidebarCollapsed") === "true";
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
    if (activeTab !== "events") return undefined;
    const refreshInterval = setInterval(refreshData, 10000);
    return () => clearInterval(refreshInterval);
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
    { id: "home", label: "Dashboard", icon: LayoutGrid },
    { id: "events", label: "Event Creation", icon: Calendar },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "live", label: "Live Attendance", icon: Activity },
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

      case "directory":
        return <MemberDirectory user={currentUser} />;

      case "live":
        return (
          <LiveAttendanceList
            variant="secretary"
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
    <div className="portal-shell attendance-workspace h-dvh flex font-sans relative overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AttendanceSidebar
        items={sidebarItems}
        activeId={activeTab}
        onSelect={setActiveTab}
        roleLabel="Secretary"
        userName={currentUser?.name}
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
            {loadError && <LoadError message={loadError} onRetry={refreshData} retrying={loading} />}
          <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <Motion.div
                key={activeTab}
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
    </div>
  );
}
