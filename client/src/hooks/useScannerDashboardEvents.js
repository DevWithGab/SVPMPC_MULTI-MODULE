import { useEffect, useState } from 'react';
import { eventAPI } from '../services/api';
import { loadDashboardRecords } from '../utils/attendanceDashboard';
import { canScanEvent } from '../utils/scannerSchedule';

export default function useScannerDashboardEvents(initialEvents) {
  const [events, setEvents] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      setNow(Date.now());
      if (pending) return;
      pending = true;
      try {
        const records = await loadDashboardRecords(eventAPI.getEvents, 'events');
        if (!disposed) {
          setEvents(records);
          setRefreshError(false);
        }
      } catch {
        if (!disposed) setRefreshError(true);
      } finally {
        pending = false;
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(onVisible, 10000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      clearInterval(clock);
      clearInterval(poll);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { activeEvents: (events ?? initialEvents).filter(event => canScanEvent(event, now)), refreshError };
}
