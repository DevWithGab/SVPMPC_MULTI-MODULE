import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { attendanceAPI, eventAPI } from '../services/api';

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
        const [attendanceData, eventsData] = await Promise.all([
          attendanceAPI.getAllAttendance(), eventAPI.getAllEvents(),
        ]);
        if (attendanceData?.success === false || eventsData?.success === false) throw new Error('Request failed');
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

  const recordAttendance = async (eventId, scanData) => {
    setLoading(true);
    try {
      const response = await attendanceAPI.recordAttendance(
        user.memberId,
        eventId,
        new Date().toISOString()
      );
      
      // Add new attendance record to local state
      const newRecord = {
        id: Date.now(),
        member_name: user.name,
        event: scanData.eventName,
        timestamp: scanData.timestamp,
      };
      
      setAttendanceLogs(prev => [newRecord, ...prev]);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error recording attendance:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    attendanceLogs,
    loadError,
    hasLoaded,
    events,
    loading,
    recordAttendance,
    refreshData: fetchAttendanceData,
  };
};