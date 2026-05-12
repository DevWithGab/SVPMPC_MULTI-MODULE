import { useState, useEffect } from "react";
import { AuthProvider } from "./hooks/useAuth.jsx";
import SystemSelector from "./pages/SystemSelector";
import SuperAdmin from "./pages/SuperAdmin";
import MortuaryAdminPortal from "./pages/mortuary/AdminPortal";
import MortuaryTreasurerPortal from "./pages/mortuary/TreasurerPortal";
import AttendanceMemberPortal from "./pages/attendance/MemberPortal";
import AttendanceSecretaryPortal from "./pages/attendance/SecretaryPortal";
import AttendanceOperatorPortal from "./pages/attendance/OperatorPortal";
import AttendanceAdminPortal from "./pages/attendance/AdminPortal";

function App() {
  const [currentView, setCurrentView] = useState("selector"); // 'selector' or 'member-portal'
  const [selectedModule, setSelectedModule] = useState(null);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  // Check for super-admin route
  useEffect(() => {
    if (window.location.pathname === "/super-admin") {
      setCurrentView("super-admin");
    }
  }, []);

  // Restore app state from localStorage on mount
  useEffect(() => {
    const storedView = localStorage.getItem("currentView");
    const storedModule = localStorage.getItem("selectedModule");
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedView && storedModule && storedUser && storedToken) {
      try {
        setCurrentView(storedView);
        setSelectedModule(JSON.parse(storedModule));
        setAuthenticatedUser({
          user: JSON.parse(storedUser),
          token: storedToken,
        });
      } catch (err) {
        console.error("Error restoring auth state:", err);
      }
    }
  }, []);

  const handleModuleSelect = (module, role, user, token) => {
    setSelectedModule({ module, role });
    setAuthenticatedUser({ user, token });

    const viewMap = {
      "mortuary-admin": "mortuary-admin-portal",
      "mortuary-treasurer": "mortuary-treasurer-portal",
      "attendance-member": "attendance-member-portal",
      "attendance-secretary": "attendance-secretary-portal",
      "attendance-scanner_operator": "attendance-operator-portal",
      "attendance-admin": "attendance-admin-portal",
    };

    const key = `${module}-${role}`;
    const view = viewMap[key] || "selector";

    setCurrentView(view);
    localStorage.setItem("currentView", view);
    localStorage.setItem("selectedModule", JSON.stringify({ module, role }));
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const handleBackToSelector = () => {
    setCurrentView("selector");
    setSelectedModule(null);
    setAuthenticatedUser(null);
    // Clear stored auth data
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("currentView");
    localStorage.removeItem("selectedModule");
  };

  return (
    <AuthProvider>
      <div className="App">
        {currentView === "super-admin" && <SuperAdmin />}
        {currentView === "selector" && (
          <SystemSelector onModuleSelect={handleModuleSelect} />
        )}
        {currentView === "mortuary-admin-portal" && (
          <MortuaryAdminPortal
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === "mortuary-treasurer-portal" && (
          <MortuaryTreasurerPortal
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === "attendance-member-portal" && (
          <AttendanceMemberPortal
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === "attendance-secretary-portal" && (
          <AttendanceSecretaryPortal
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === "attendance-operator-portal" && (
          <AttendanceOperatorPortal
            onBack={handleBackToSelector}
            user={authenticatedUser?.user}
            token={authenticatedUser?.token}
          />
        )}
        {currentView === "attendance-admin-portal" && (
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
