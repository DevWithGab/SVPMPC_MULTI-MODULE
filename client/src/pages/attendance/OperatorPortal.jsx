import AttendanceSidebar, { AttendanceMobileBar } from '../../components/attendance/shared/AttendanceSidebar';
import LoadError from '../../components/shared/common/LoadError';
import useUrlState from '../../hooks/useUrlState';
import { useState, useEffect } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  QrCode,
  Activity,
  History,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useAttendance } from "../../hooks/useAttendance";
import {
  Dashboard,
  QRScanner,
  MyScans,
} from "../../components/attendance/scanner_operator";
import { LiveAttendanceList } from "../../components/attendance/shared";


export default function AttendanceOperatorPortal({
  onBack,
  user: propUser,
  token: propToken,
}) {
  const { user, updateAuth } = useAuth();
  const currentUser = propUser || user;

  useEffect(() => {
    if (propUser && propToken) {
      updateAuth(propUser, propToken);
    }
  }, [propUser, propToken, updateAuth]);

  useEffect(() => {
    if (
      currentUser?.role &&
      !["scanner_operator", "secretary", "admin"].includes(currentUser.role)
    ) {
      alert(
        "This session isn't signed in as a Scanner Operator. Please log in again with a Scanner Operator account.",
      );
      onBack?.();
    }
  }, [currentUser, onBack]);

  const { attendanceLogs, events, refreshData, loadError, loading, hasLoaded } = useAttendance();
  const [activeTab, setActiveTab] = useUrlState('tab', 'home', ['home', 'scanner', 'live', 'myscans']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("operatorSidebarCollapsed") === "true";
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
      "operatorSidebarCollapsed",
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarItems = [
    { id: "home", label: "Dashboard", icon: LayoutGrid },
    { id: "scanner", label: "Scan Attendance", icon: QrCode },
    { id: "live", label: "Live Attendance", icon: Activity },
    { id: "myscans", label: "My Scans", icon: History },
  ];

  const handleScanSuccess = (scanData) => {
    console.log("Scanner operator scan successful:", scanData);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "scanner":
        return (
          <QRScanner
            user={currentUser}
            events={events}
            onScanSuccess={handleScanSuccess}
            onViewAll={() => setActiveTab("live")}
          />
        );
      case "live":
        return (
          <LiveAttendanceList
            variant="operator"
            attendanceLogs={attendanceLogs}
            events={events}
            onRefresh={refreshData}
          />
        );
      case "myscans":
        return <MyScans user={currentUser} />;
      default:
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
        roleLabel="Scanner Operator"
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
