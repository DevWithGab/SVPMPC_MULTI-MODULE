import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { memberPortalAPI, attendanceAPI, eventAPI } from '../services/api';

export const useAttendance = () => {
  const { user, token } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

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
        // Fetch attendance history for members, or all recent attendance for scanner operators.
        const attendanceData = user?.role === 'scanner_operator'
          ? await attendanceAPI.getAllAttendance()
          : await memberPortalAPI.getAttendanceHistory(user.memberId);

        setAttendanceLogs(normalizeAttendance(attendanceData));

        // Fetch events
        const eventsData = await eventAPI.getAllEvents();
        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : Array.isArray(eventsData?.events)
            ? eventsData.events
            : []
        );
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        setAttendanceLogs([]);
        setEvents([]);
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
    events,
    loading,
    recordAttendance,
    refreshData: fetchAttendanceData,
  };
};