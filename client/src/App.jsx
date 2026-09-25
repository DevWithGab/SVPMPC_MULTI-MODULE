import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import SystemSelector from "./pages/SystemSelector";
import SuperAdmin from "./pages/SuperAdmin";
import MortuaryAdminPortal from "./pages/mortuary/AdminPortal";
import MortuaryTreasurerPortal from "./pages/mortuary/TreasurerPortal";
import AttendanceSecretaryPortal from "./pages/attendance/SecretaryPortal";
import AttendanceOperatorPortal from "./pages/attendance/OperatorPortal";
import AttendanceAdminPortal from "./pages/attendance/AdminPortal";

import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
  const { updateAuth, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const home = session ? portalPath(session.module, session.role) : '/';

  const handleLogin = (module, role, user, token) => {
    const path = portalPath(module, role);
    if (!portals[path]) return;
    localStorage.setItem('selectedModule', JSON.stringify({ module, role }));
    updateAuth(user, token);
    setSession({ module, role, user, token });
    const requested = location.state?.from;
    navigate(requested?.pathname === path ? requested : path, { replace: true });
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('currentView');
    localStorage.removeItem('selectedModule');
    setSession(null);
    navigate('/', { replace: true });
  };

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to={home} replace /> : <SystemSelector onModuleSelect={handleLogin} />} />
      <Route path="/super-admin" element={<SuperAdmin />} />
      {Object.entries(portals).map(([path, Portal]) => (
        <Route key={path} path={path} element={
          !session ? <Navigate to="/" replace state={{ from: { pathname: location.pathname, search: location.search } }} />
            : home !== path ? <Navigate to={home} replace />
              : <Portal user={session.user} token={session.token} onBack={handleLogout} />
        } />
      ))}
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
