const AUTH_SESSION_KEYS = ['token', 'user', 'selectedModule', 'currentView'];

export function readAuthSession(storage = window.sessionStorage) {
  try {
    const token = storage.getItem('token');
    const user = JSON.parse(storage.getItem('user'));
    return token && user && typeof user === 'object' && !Array.isArray(user)
      ? { token, user } : null;
  } catch {
    return null;
  }
}

export function clearAuthSession(storage = window.sessionStorage) {
  AUTH_SESSION_KEYS.forEach(key => storage.removeItem(key));
}

export function initializeTabSession(browser = window) {
  // Do not import the former browser-wide login into a new tab. Remove
  // only authentication keys, preserving preferences and update markers.
  try {
    clearAuthSession(browser.localStorage);
  } catch {
    // Shared storage can be disabled independently of session storage.
  }

  // A window opened by another page can receive a copy of its sessionStorage.
  // Start that window at login, then detach its opener so its own reloads
  // preserve the account it subsequently signs in with.
  if (browser.opener) {
    clearAuthSession(browser.sessionStorage);
    browser.opener = null;
  }
}
