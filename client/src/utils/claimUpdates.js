export const CLAIMS_UPDATED_EVENT = 'svpmpc:claims-updated';
export const CLAIMS_UPDATED_KEY = 'svpmpc:claims-updated-at';

export function notifyClaimsUpdated() {
  window.dispatchEvent(new window.Event(CLAIMS_UPDATED_EVENT));
  try { window.localStorage.setItem(CLAIMS_UPDATED_KEY, `${Date.now()}:${Math.random()}`); }
  catch { /* Polling also covers devices and browsers without storage access. */ }
}

export function subscribeClaimUpdates(refresh) {
  const visibleRefresh = () => { if (!document.hidden) refresh(); };
  const storageRefresh = event => { if (event.key === CLAIMS_UPDATED_KEY) visibleRefresh(); };
  const interval = window.setInterval(visibleRefresh, 5000);
  window.addEventListener(CLAIMS_UPDATED_EVENT, visibleRefresh);
  window.addEventListener('storage', storageRefresh);
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener(CLAIMS_UPDATED_EVENT, visibleRefresh);
    window.removeEventListener('storage', storageRefresh);
    window.removeEventListener('focus', visibleRefresh);
    document.removeEventListener('visibilitychange', visibleRefresh);
  };
}
