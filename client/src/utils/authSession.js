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
  /* Huwag i-import yung dating browser-wide login papunta sa bagong tab.
  Tanggalin lang yung authentication keys, pero i-preserve yung
  preferences at update markers. */
  try {
    clearAuthSession(browser.localStorage);
  } catch {
    // Shared storage can be disabled independently of session storage.
  }

  /* Yung window na binuksan ng ibang page ay posibleng makatanggap ng kopya
  ng sessionStorage nito. Simulan yung window na iyon sa login, tapos
  i-detach yung opener nito para yung sariling reloads niya ay
  mapreserve yung account na ikinasign-in dito. */
  if (browser.opener) {
    clearAuthSession(browser.sessionStorage);
    browser.opener = null;
  }
}
