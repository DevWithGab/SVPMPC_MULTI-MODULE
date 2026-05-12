import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  BarChart3,
  Settings,
  QrCode,
  FileText,
  Activity,
  Shield,
} from "lucide-react";
import {
  Dashboard,
  EventManagement,
  MemberManagement,
  Reports,
  AuditLogs,
} from "../../components/attendance/admin";
import { LiveAttendanceList } from "../../components/attendance/shared";
import { memberAPI, eventAPI, attendanceAPI } from "../../services/api";

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

const AdminPortal = ({ onBack }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // State for data
  const [members, setMembers] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);

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

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "live", label: "Live Attendance", icon: Activity },
    { id: "events", label: "Event Management", icon: Calendar },
    { id: "members", label: "Member Management", icon: Users },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "auditlogs", label: "Audit Logs", icon: Shield },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading attendance system...
          </p>
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
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-100">
                  <img
                    src="/SVPMPC-LOGO(MAIN).png"
                    alt="SVMPC Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: "#2D7A3E" }}
                  >
                    Attendance Admin
                  </h2>
                  <p className="text-sm text-gray-600">System Management</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-100">
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
                  <span className="ml-3">{item.label}</span>
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

          {activeSection === "settings" && (
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2
                className="text-xl font-semibold mb-4"
                style={{ color: "#2D7A3E" }}
              >
                Settings
              </h2>
              <p className="text-gray-500">
                System settings will be implemented here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
