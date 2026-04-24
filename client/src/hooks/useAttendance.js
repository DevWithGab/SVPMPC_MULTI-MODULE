import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { memberPortalAPI, attendanceAPI, eventAPI } from '../services/api';

export const useAttendance = () => {
  const { user, token } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch real data from API
  const fetchAttendanceData = async () => {
    if (user && token) {
      setLoading(true);
      try {
        // Fetch attendance history
        const attendanceData = await memberPortalAPI.getAttendanceHistory(user.memberId);
        setAttendanceLogs(attendanceData.attendance || []);

        // Fetch events
        const eventsData = await eventAPI.getAllEvents();
        setEvents(eventsData.events || []);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        // Set mock data on error for development
        setAttendanceLogs([
          {
            id: 1,
            member_name: user.name || 'John Doe',
            event: 'Weekly Meeting',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          },
          {
            id: 2,
            member_name: user.name || 'John Doe',
            event: 'Community Service',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          },
          {
            id: 3,
            member_name: user.name || 'John Doe',
            event: 'Training Session',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          },
          {
            id: 4,
            member_name: user.name || 'John Doe',
            event: 'Monthly Assembly',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
          },
          {
            id: 5,
            member_name: user.name || 'John Doe',
            event: 'Orientation',
            timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
          },
        ]);
        
        setEvents([
          {
            id: 1,
            eventName: 'Weekly Meeting',
            eventDate: new Date().toISOString(),
            eventTime: '14:00',
            location: 'Main Hall',
            status: 'active'
          },
          {
            id: 2,
            eventName: 'Community Service',
            eventDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            eventTime: '09:00',
            location: 'Community Center',
            status: 'upcoming'
          }
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [user, token]);

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