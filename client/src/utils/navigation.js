const roles = {
  mortuary: ['admin', 'treasurer'],
  attendance: ['admin', 'secretary', 'scanner_operator'],
};

export function portalPath(module, role) {
  return roles[module]?.includes(role) ? `/${module}/${role}` : '/';
}

export function readSession(storage = localStorage) {
  try {
    const token = storage.getItem('token');
    const user = JSON.parse(storage.getItem('user'));
    const selection = JSON.parse(storage.getItem('selectedModule'));
    if (!token || !user || !selection || portalPath(selection.module, selection.role) === '/') return null;
    if (user.role !== selection.role && user.role !== 'super_admin') return null;
    return { ...selection, user, token };
  } catch {
    return null;
  }
}

export function readUrlValue(search, key, fallback, allowed) {
  const value = new URLSearchParams(search).get(key);
  return value && (!allowed || allowed.includes(value)) ? value : fallback;
}

export function updateUrlValue(search, key, value, fallback, extra = {}) {
  const params = new URLSearchParams(search);
  if (key === 'tab') ['claim', 'member', 'claimsView'].forEach(name => params.delete(name));
  for (const [name, next] of Object.entries({ [key]: value === fallback ? null : value, ...extra })) {
    if (next == null || next === '') params.delete(name);
    else params.set(name, String(next));
  }
  return params.toString();
}
