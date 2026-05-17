import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  BarChart3,
  QrCode,
  FileText,
  Activity,
  Shield,
  Database,
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
    { id: "backup", label: "Database Backup", icon: Database },
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

          {activeSection === "backup" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#2D7A3E" }}>Database Backup</h2>
                  <p className="text-gray-600 font-medium">Export and secure your attendance system data for emergency recovery</p>
                </div>
              </div>

              {/* Backup Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <Users className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Members</p>
                    <p className="text-xl font-bold text-gray-900">{members.length}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Calendar className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Events</p>
                    <p className="text-xl font-bold text-gray-900">{events.length}</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <Activity className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Attendance Records</p>
                    <p className="text-xl font-bold text-gray-900">{attendanceLogs.length}</p>
                  </div>
                </div>
              </div>

              {/* Backup Options */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Members CSV Backup */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-emerald-50 rounded-xl flex-shrink-0">
                      <Users className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">Members Database</h3>
                      <p className="text-sm text-gray-600 font-medium mt-1">Export all member records in CSV format</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Total Records</span>
                      <span className="font-bold text-gray-900">{members.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Format</span>
                      <span className="font-bold text-gray-900">CSV</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Includes</span>
                      <span className="font-bold text-gray-900">All Fields</span>
                    </div>
                  </div>

                  <button 
                    className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                      const csv = [
                        ['ID', 'Name', 'Email', 'Phone', 'Status', 'Join Date'].join(','),
                        ...members.map(m => [
                          m.memberId || m.id, 
                          m.memberName || m.name, 
                          m.email || '', 
                          m.phoneNumber || m.contact || '', 
                          m.status || 'active', 
                          m.createdAt || m.join_date || ''
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                      ].join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `attendance_members_backup_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Download Members CSV
                  </button>
                </div>

                {/* Events CSV Backup */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-blue-50 rounded-xl flex-shrink-0">
                      <Calendar className="w-6 h-6 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">Events Database</h3>
                      <p className="text-sm text-gray-600 font-medium mt-1">Export all event records in CSV format</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Total Records</span>
                      <span className="font-bold text-gray-900">{events.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Format</span>
                      <span className="font-bold text-gray-900">CSV</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Includes</span>
                      <span className="font-bold text-gray-900">All Fields</span>
                    </div>
                  </div>

                  <button 
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                      const csv = [
                        ['ID', 'Name', 'Date', 'Location', 'Status', 'Created At'].join(','),
                        ...events.map(e => [
                          e.eventId || e.id, 
                          e.eventName || e.name, 
                          e.eventDate || e.date, 
                          e.location || '', 
                          e.status || 'active', 
                          e.createdAt || ''
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                      ].join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `attendance_events_backup_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Download Events CSV
                  </button>
                </div>

                {/* Attendance Logs CSV Backup */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-purple-50 rounded-xl flex-shrink-0">
                      <Activity className="w-6 h-6 text-purple-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">Attendance Logs</h3>
                      <p className="text-sm text-gray-600 font-medium mt-1">Export all attendance records in CSV format</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Total Records</span>
                      <span className="font-bold text-gray-900">{attendanceLogs.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Format</span>
                      <span className="font-bold text-gray-900">CSV</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Includes</span>
                      <span className="font-bold text-gray-900">All Fields</span>
                    </div>
                  </div>

                  <button 
                    className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                      const csv = [
                        ['Member ID', 'Member Name', 'Event ID', 'Event Name', 'Scan Time', 'Status'].join(','),
                        ...attendanceLogs.map(log => {
                          const normalized = normalizeAttendanceRecord(log);
                          return [
                            normalized.memberId || '', 
                            normalized.memberName || '', 
                            normalized.eventId || '', 
                            normalized.eventName || '', 
                            normalized.scanTime || '', 
                            normalized.status || 'present'
                          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
                        })
                      ].join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `attendance_logs_backup_${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Download Attendance CSV
                  </button>
                </div>

                {/* Full JSON Backup */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-amber-50 rounded-xl flex-shrink-0">
                      <Database className="w-6 h-6 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">Complete System Backup</h3>
                      <p className="text-sm text-gray-600 font-medium mt-1">Full database export in JSON format</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Members</span>
                      <span className="font-bold text-gray-900">{members.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Events</span>
                      <span className="font-bold text-gray-900">{events.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">Attendance</span>
                      <span className="font-bold text-gray-900">{attendanceLogs.length}</span>
                    </div>
                  </div>

                  <button 
                    className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                      const data = {
                        exportDate: new Date().toISOString(),
                        exportVersion: '1.0',
                        system: 'Attendance Management System',
                        members: members,
                        events: events,
                        attendanceLogs: attendanceLogs,
                        metadata: {
                          totalMembers: members.length,
                          totalEvents: events.length,
                          totalAttendance: attendanceLogs.length,
                          exportedBy: 'Admin'
                        }
                      };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `attendance_full_backup_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Download JSON Backup
                  </button>
                </div>
              </div>

              {/* Backup Instructions */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl bg-amber-50/30 p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Backup Best Practices</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span><strong className="font-bold text-gray-900">Regular Backups:</strong> Download backups weekly or after major data changes</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span><strong className="font-bold text-gray-900">Secure Storage:</strong> Store backup files in a secure location (external drive, cloud storage)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span><strong className="font-bold text-gray-900">Multiple Copies:</strong> Keep at least 2-3 backup copies in different locations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <span><strong className="font-bold text-gray-900">Test Recovery:</strong> Periodically verify that backup files can be opened and read</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
