import { useEffect, useMemo, useState } from 'react';
import { scheduledSecretaryEvent } from '../utils/eventManagement';

export default function useScheduledSecretaryEvents(events) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return useMemo(() => events.map(event => scheduledSecretaryEvent(event, now)), [events, now]);
}
