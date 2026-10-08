import { createElement, useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import SystemSelector from "./pages/SystemSelector";
import SuperAdmin from "./pages/SuperAdmin";
import RequiredPasswordChange from './components/shared/RequiredPasswordChange';
import MortuaryAdminPortal from "./pages/mortuary/AdminPortal";
import MortuaryTreasurerPortal from "./pages/mortuary/TreasurerPortal";
import AttendanceSecretaryPortal from "./pages/attendance/SecretaryPortal";
import AttendanceOperatorPortal from "./pages/attendance/OperatorPortal";
import AttendanceAdminPortal from "./pages/attendance/AdminPortal";

import { BrowserRouter, Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { readSession, portalPath } from './utils/navigation';
const portals = {
  '/mortuary/admin': MortuaryAdminPortal,
  '/mortuary/treasurer': MortuaryTreasurerPortal,
  '/attendance/secretary': AttendanceSecretaryPortal,
  '/attendance/scanner_operator': AttendanceOperatorPortal,
  '/attendance/admin': AttendanceAdminPortal,
};

function AppRoutes() {
  const [session, setSession] = useState(readSession);
  const { updateAuth, logout, user: authUser, token: authToken, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = authUser?.role === 'super_admin';
  const home = isSuperAdmin ? '/super-admin' : session ? portalPath(session.module, session.role) : '/';

  const handleLogin = (module, role, user, token) => {
    const path = portalPath(module, role);
    if (!portals[path]) return;
    localStorage.setItem('selectedModule', JSON.stringify({ module, role }));
    updateAuth(user, token);
    setSession({ module, role, user, token });
    const requested = location.state?.from;
    navigate(user.role === 'super_admin' ? '/super-admin' : requested?.pathname === path ? requested : path, { replace: true });
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('currentView');
    localStorage.removeItem('selectedModule');
    setSession(null);
    navigate('/', { replace: true });
  };

  if (loading) return <p className="p-8">Loading session...</p>;
  if (authUser?.isTemporaryPassword) return <RequiredPasswordChange user={authUser} onLogout={handleLogout} onComplete={user => {
    updateAuth(user, authToken);
    setSession(previous => previous ? { ...previous, user } : previous);
  }} />;
  const routesElement = (
    <Routes>
      <Route path="/" element={session || isSuperAdmin ? <Navigate to={home} replace /> : <SystemSelector onModuleSelect={handleLogin} />} />
      <Route path="/super-admin" element={<SuperAdmin onAuthenticated={(user, token) => handleLogin('attendance', 'admin', user, token)} onLogout={handleLogout} />} />
      {Object.entries(portals).map(([path, Portal]) => (
        <Route key={path} path={path} element={
          isSuperAdmin && path.endsWith('/admin') ? createElement(Portal, { user: authUser, token: authToken, onBack: handleLogout })
            : !session ? <Navigate to="/" replace state={{ from: { pathname: location.pathname, search: location.search } }} />
            : home !== path ? <Navigate to={home} replace />
              : createElement(Portal, { user: session.user, token: session.token, onBack: handleLogout })
        } />
      ))}
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );

  // Only the two /admin portals fill exactly 100dvh internally and manage
  // their own scrolling — stacking the superadmin nav bar above them needs
  // this height-constrained flex column so the nav bar gets its own space
  // instead of the portal's full 100dvh overflowing past it (that's what
  // hid the sidebar's collapse toggle below the fold). Every other
  // superadmin route (the hub itself, the login screen) relies on normal
  // page scrolling via min-h-screen, so it must NOT be wrapped the same
  // way — doing so clips it against overflow-hidden with no way to scroll.
  const isAdminPortalRoute = location.pathname === '/attendance/admin' || location.pathname === '/mortuary/admin';
  if (isSuperAdmin && isAdminPortalRoute) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <nav aria-label="Superadmin navigation" className="flex flex-wrap gap-5 bg-emerald-900 text-white p-3 shrink-0">
          <Link to="/super-admin">Superadmin hub</Link><Link to="/attendance/admin">Attendance</Link><Link to="/mortuary/admin">Mortuary</Link>
          <button className="ml-auto" onClick={handleLogout}>Sign out</button>
        </nav>
        <div className="flex-1 min-h-0">{routesElement}</div>
      </div>
    );
  }

  return (<>
    {isSuperAdmin && <nav aria-label="Superadmin navigation" className="flex flex-wrap gap-5 bg-emerald-900 text-white p-3">
      <Link to="/super-admin">Superadmin hub</Link><Link to="/attendance/admin">Attendance</Link><Link to="/mortuary/admin">Mortuary</Link>
      <button className="ml-auto" onClick={handleLogout}>Sign out</button>
    </nav>}
    {routesElement}
  </>);
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
