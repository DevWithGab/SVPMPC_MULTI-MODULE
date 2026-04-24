import { useState, useEffect } from 'react';
import { AuthProvider } from './hooks/useAuth.jsx';
import SystemSelector from './pages/SystemSelector';
import SuperAdmin from './pages/SuperAdmin';
import MortuaryMemberPortal from './pages/mortuary/MemberPortal';
import MortuaryAdminPortal from './pages/mortuary/AdminPortal';
import MortuaryTreasurerPortal from './pages/mortuary/TreasurerPortal';
import AttendanceMemberPortal from './pages/attendance/MemberPortal';
import AttendanceSecretaryPortal from './pages/attendance/SecretaryPortal';
import AttendanceAdminPortal from './pages/attendance/AdminPortal';

function App() {
  const [currentView, setCurrentView] = useState('selector'); // 'selector' or 'member-portal'
  const [selectedModule, setSelectedModule] = useState(null);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  // Check for super-admin route
  useEffect(() => {
    if (window.location.pathname === '/super-admin') {
      setCurrentView('super-admin');
    }
  }, []);

  const handleModuleSelect = (module, role, user, token) => {
    setSelectedModule({ module, role });
    setAuthenticatedUser({ user, token });
    
    if (module === 'mortuary' && role === 'member') {
      setCurrentView('mortuary-member-portal');
    } else if (module === 'mortuary' && role === 'admin') {
      setCurrentView('mortuary-admin-portal');
    } else if (module === 'mortuary' && role === 'treasurer') {
      setCurrentView('mortuary-treasurer-portal');
    } else if (module === 'attendance' && role === 'member') {
      setCurrentView('attendance-member-portal');
    } else if (module === 'attendance' && role === 'secretary') {
      setCurrentView('attendance-secretary-portal');
    } else if (module === 'attendance' && role === 'admin') {
      setCurrentView('attendance-admin-portal');
    }
    // Add more conditions for other modules/roles as needed
  };

  const handleBackToSelector = () => {
    setCurrentView('selector');
    setSelectedModule(null);
    setAuthenticatedUser(null);
    // Clear stored auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthProvider>
      <div className="App">
        {currentView === 'super-admin' && (
          <SuperAdmin />
        )}
        {currentView === 'selector' && (
          <SystemSelector onModuleSelect={handleModuleSelect} />
        )}
        {currentView === 'mortuary-member-portal' && (
          <MortuaryMemberPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === 'mortuary-admin-portal' && (
          <MortuaryAdminPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === 'mortuary-treasurer-portal' && (
          <MortuaryTreasurerPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === 'attendance-member-portal' && (
          <AttendanceMemberPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === 'attendance-secretary-portal' && (
          <AttendanceSecretaryPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === 'attendance-admin-portal' && (
          <AttendanceAdminPortal 
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
      </div>
    </AuthProvider>
  );
}

export default App;
