import { createElement, useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { withDisplayName } from "./utils/authSession";
import SystemSelector from "./pages/SystemSelector";
import SuperAdmin from "./pages/SuperAdmin";
import RequiredPasswordChange from './components/shared/RequiredPasswordChange';
import MortuaryAdminPortal from "./pages/mortuary/AdminPortal";
import MortuaryTreasurerPortal from "./pages/mortuary/TreasurerPortal";
import AttendanceSecretaryPortal from "./pages/attendance/SecretaryPortal";
import AttendanceOperatorPortal from "./pages/attendance/OperatorPortal";


import { BrowserRouter, Navigate, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import { readSession, portalPath } from './utils/navigation';
import { MODULE_ROLES } from './utils/constants';

/* Ito yung nagsasabi kung anong component ang ira-render para sa bawat (module, role)
pair. Yung mismong listahan ng mga pair na valid ay naka-define na sa constants.js
(ROLE_MODULES) - dito lang kailangan sabihin kung ANO ang ipapakita sa bawat isa,
hindi kung alin sa mga pair ang valid. */
const PORTAL_COMPONENTS = {
  '/mortuary/claims_officer': MortuaryAdminPortal,
  '/mortuary/finance_officer': MortuaryTreasurerPortal,
  '/attendance/secretary': AttendanceSecretaryPortal,
  '/attendance/scanner_operator': AttendanceOperatorPortal,

};

/* Galing ito sa MODULE_ROLES, kaya kung may role/module na idinagdag sa constants.js
na walang kaparehas na entry dito, malakas na dev-console warning agad ang lalabas
imbes na tahimik lang na mapupunta sa dead end sa login routing. */
const portals = Object.fromEntries(
  Object.entries(MODULE_ROLES).flatMap(([module, roles]) => roles.map(role => {
    const path = portalPath(module, role);
    const Component = PORTAL_COMPONENTS[path];
    if (!Component && import.meta.env.DEV) {
      console.warn(`No portal component registered for "${path}" in App.jsx's PORTAL_COMPONENTS — add one, or this role can never reach a portal after login.`);
    }
    return [path, Component];
  })).filter(([, Component]) => Component)
);

function AppRoutes() {
  const [session, setSession] = useState(readSession);
  const [loginNotice, setLoginNotice] = useState('');
  const { updateAuth, logout, user: authUser, token: authToken, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = authUser?.role === 'super_admin';
  const home = isSuperAdmin ? '/super-admin' : session ? portalPath(session.module, session.role) : '/';

  const handleLogin = (module, role, user, token) => {
    const path = portalPath(module, role);
    if (!portals[path]) return;
    setLoginNotice('');
    window.sessionStorage.setItem('selectedModule', JSON.stringify({ module, role }));
    updateAuth(user, token);
    setSession({ module, role, user: withDisplayName(user), token });
    const requested = location.state?.from;
    navigate(user.role === 'super_admin' ? '/super-admin' : requested?.pathname === path ? requested : path, { replace: true });
  };

  const handleLogout = () => {
    logout();
    window.sessionStorage.removeItem('currentView');
    window.sessionStorage.removeItem('selectedModule');
    setSession(null);
    navigate('/', { replace: true });
  };

  if (loading) return <p className="p-8">Loading session...</p>;
  if (authUser?.isTemporaryPassword) return <RequiredPasswordChange user={authUser} onLogout={handleLogout} onComplete={() => {
    handleLogout();
    setLoginNotice('Password changed successfully. Sign in again with your new password.');
  }} />;
  const routesElement = (
    <Routes>
      <Route path="/" element={session || isSuperAdmin ? <Navigate to={home} replace /> : <SystemSelector key={location.search} onModuleSelect={handleLogin} notice={loginNotice} />} />
      <Route path="/super-admin" element={<SuperAdmin onAuthenticated={(user, token) => handleLogin('attendance', 'secretary', user, token)} />} />
      {Object.entries(portals).map(([path, Portal]) => (
        <Route key={path} path={path} element={
          isSuperAdmin && (path === '/attendance/secretary' || path.startsWith('/mortuary/')) ? createElement(Portal, { user: authUser, token: authToken, onBack: handleLogout })
            : !session ? <Navigate to="/" replace state={{ from: { pathname: location.pathname, search: location.search } }} />
            : home !== path ? <Navigate to={home} replace />
              : createElement(Portal, { user: session.user, token: session.token, onBack: handleLogout })
        } />
      ))}
      <Route path="/attendance/admin" element={<Navigate to="/attendance/secretary" replace />} />
      <Route path="/mortuary/admin" element={<Navigate to="/mortuary/claims_officer" replace />} />
      <Route path="/mortuary/treasurer" element={<Navigate to="/mortuary/finance_officer" replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );

  /* Dalawang /admin portals lang ang pumupuno ng exact 100dvh sa loob at nag-manage
  ng sarili nilang scrolling - kapag nilagay sa taas ang superadmin nav bar, kailangan
  nito itong height-constrained flex column para may sariling space ang nav bar imbes
  na ma-overflow ng buong 100dvh ng portal papalagpas dito (dahil dito nahihide yung
  collapse toggle ng sidebar sa ibaba). Yung ibang superadmin routes (hub mismo, login
  screen) ay umaasa sa normal page scrolling gamit ang min-h-screen, kaya HINDI dapat
  i-wrap ng ganito - kapag ginawa, ma-clip ito laban sa overflow-hidden na walang
  paraan para mag-scroll. */
  const isAdminPortalRoute = location.pathname === '/attendance/secretary' || location.pathname.startsWith('/mortuary/');
  if (isSuperAdmin && isAdminPortalRoute) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <nav aria-label="Superadmin navigation" className="flex flex-wrap gap-5 bg-[var(--ui-primary-hover)] text-white p-3 shrink-0">
          <Link to="/super-admin">Superadmin hub</Link><Link to="/attendance/admin">Attendance</Link><Link to="/mortuary/claims_officer">Mortuary</Link>
          <button className="ml-auto" onClick={handleLogout}>Sign out</button>
        </nav>
        <div className="flex-1 min-h-0">{routesElement}</div>
      </div>
    );
  }

  return (<>
    {isSuperAdmin && <nav aria-label="Superadmin navigation" className="flex flex-wrap gap-5 bg-[var(--ui-primary-hover)] text-white p-3">
      <Link to="/super-admin">Superadmin hub</Link><Link to="/attendance/admin">Attendance</Link><Link to="/mortuary/claims_officer">Mortuary</Link>
      <button className="ml-auto" onClick={handleLogout}>Sign out</button>
    </nav>}
    {routesElement}
  </>);
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
