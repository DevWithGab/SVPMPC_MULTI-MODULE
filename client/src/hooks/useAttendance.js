import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { attendanceAPI, eventAPI } from '../services/api';
import { loadDashboardRecords } from '../utils/attendanceDashboard';

export const useAttendance = () => {
  const { user, token } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const normalizeAttendance = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.attendance)) return data.attendance;
    if (Array.isArray(data?.attendanceLogs)) return data.attendanceLogs;
    if (Array.isArray(data?.attendanceHistory)) return data.attendanceHistory;
    if (Array.isArray(data?.records)) return data.records;
    return [];
  };

  // Fetch real data from API
  const fetchAttendanceData = useCallback(async () => {
    if (user && token) {
      setLoading(true);
      try {
        /* Yung getAllAttendance() lang, naka-cap sa default page size ng server
        (10) - si loadDashboardRecords ang nag-page through sa lahat ng record,
        same fix na ginawa sa AdminPortal.jsx at sa Dashboard/Reports screens
        ng Secretary. Kung wala nito, lahat ng gumagamit ng hook na ito
        (Secretary at Scanner Operator portals) ay mali yung count ng
        attendance pag lumagpas na ng 10 total scans ang event system-wide. */
        const [attendanceData, eventsData] = await Promise.all([
          loadDashboardRecords(attendanceAPI.getAllAttendance, 'attendance'), eventAPI.getAllEvents(),
        ]);
        if (eventsData?.success === false) throw new Error('Request failed');
        setAttendanceLogs(normalizeAttendance(attendanceData));
        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : Array.isArray(eventsData?.events)
            ? eventsData.events
          : Array.isArray(eventsData?.data)
          ? eventsData.data
            : []
        );
        setHasLoaded(true);
        setLoadError(null);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        setLoadError('Unable to refresh attendance and events.');
      } finally {
        setLoading(false);
      }
    }
  }, [user, token]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  return {
    attendanceLogs,
    loadError,
    hasLoaded,
    events,
    loading,
    refreshData: fetchAttendanceData,
  };
};