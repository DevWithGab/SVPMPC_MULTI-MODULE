import { useState } from "react";
import useLoginNavigation from '../hooks/useLoginNavigation';
import {
  Wallet,
  QrCode,
  UserCheck,
  Shield,
  ClipboardList,
} from "lucide-react";

// Import our new components
import BrandingPanel from "../components/shared/BrandingPanel";
import ModuleSelection from "../components/shared/ModuleSelection";
import RoleSelection from "../components/shared/RoleSelection";
import LoginForm from "../components/shared/LoginForm";
import TerminalFooter from "../components/shared/TerminalFooter";
import './SystemSelector.css';

// API Base URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

export default function SystemSelector({ onModuleSelect, notice }) {
  const { selectedSystem, selectedRole, step, selectSystem, selectRole, back } = useLoginNavigation();
  const [adminLoginData, setAdminLoginData] = useState({
    username: "",
    password: "",
  });
  const [secretaryLoginData, setSecretaryLoginData] = useState({
    username: "",
    password: "",
  });
  const [treasurerLoginData, setTreasurerLoginData] = useState({
    username: "",
    password: "",
  });
  const [operatorLoginData, setOperatorLoginData] = useState({
    username: "",
    password: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const systems = [
    {
      id: "mortuary",
      title: "Mortuary Services",
      description: "Members, Claims and Notices",
      icon: Wallet,
      color: "bg-coop-green",
      hoverColor: "hover:bg-coop-green",
      features: [
        "Contribution Tracking",
        "Claims Processing",
        "Payment Schedules",
        "Ledger Management",
      ],
    },
    {
      id: "attendance",
      title: "Attendance System",
      description: "Events, QR codes, and attendance",
      icon: QrCode,
      color: "bg-coop-green",
      hoverColor: "hover:bg-coop-green",
      features: [
        "QR Code Scanning",
        "Real-time Tracking",
        "Event Management",
        "Reports & Analytics",
      ],
    },
  ];

  const getRolesForSystem = (systemId) => {
    const baseRoles = [
      {
        id: "admin",
        title: "Admin",
        description: "Administrative access",
        icon: Shield,
        code: "ADM",
      },
    ];

    // Add specific roles based on system
    if (systemId === "attendance") {
      // Add secretary role
      baseRoles.unshift({
        id: "secretary",
        title: "Secretary",
        description: "Manage events & attendance",
        icon: ClipboardList,
        code: "SEC",
      });
      baseRoles.splice(1, 0, {
        id: "scanner_operator",
        title: "Scanner Operator",
        description: "Scan attendance QR codes",
        icon: UserCheck,
        code: "SOP",
      });
    }

    return baseRoles;
  };

  const handleSystemSelect = (systemId) => {
    selectSystem(systemId);
  };

  const handleRoleSelect = (roleId) => {
    setLoginError("");
    setShowPassword(false);
    selectRole(roleId);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: adminLoginData.username,
          password: adminLoginData.password,
          expectedRole: selectedRole || "admin",
          module: selectedSystem,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        window.sessionStorage.setItem("token", data.token);
        window.sessionStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(
            selectedSystem,
            selectedRole || "admin",
            data.user,
            data.token,
          );
        }

        // Reset form
        setAdminLoginData({ username: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSecretaryLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: secretaryLoginData.username,
          password: secretaryLoginData.password,
          expectedRole: "secretary",
          module: selectedSystem,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        window.sessionStorage.setItem("token", data.token);
        window.sessionStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(selectedSystem, "secretary", data.user, data.token);
        }

        // Reset form
        setSecretaryLoginData({ username: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOperatorLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: operatorLoginData.username,
          password: operatorLoginData.password,
          expectedRole: "scanner_operator",
          module: selectedSystem,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        window.sessionStorage.setItem("token", data.token);
        window.sessionStorage.setItem("user", JSON.stringify(data.user));

        if (onModuleSelect) {
          onModuleSelect(
            selectedSystem,
            data.user.role || "scanner_operator",
            data.user,
            data.token,
          );
        }

        setOperatorLoginData({ username: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTreasurerLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: treasurerLoginData.username,
          password: treasurerLoginData.password,
          module: selectedSystem,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        window.sessionStorage.setItem("token", data.token);
        window.sessionStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(selectedSystem, data.user.role === 'super_admin' ? 'claims_officer' : data.user.role, data.user, data.token);
        }

        // Reset form
        setTreasurerLoginData({ username: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBack = () => {
    if (
      step === "ADMIN_LOGIN" ||
      step === "SECRETARY_LOGIN" ||
      step === "MORTUARY_LOGIN" ||
      step === "OPERATOR_LOGIN"
    ) {
      back();
      setLoginError("");
      setAdminLoginData({ username: "", password: "" });
      setSecretaryLoginData({ username: "", password: "" });
      setTreasurerLoginData({ username: "", password: "" });
      setOperatorLoginData({ username: "", password: "" });
      setShowPassword(false);
    } else if (step === "ROLE_SELECTION") {
      back();
    }

    // Clear any stored authentication data when going back
    window.sessionStorage.removeItem("token");
    window.sessionStorage.removeItem("user");
  };

  return (
    <div className="system-selector min-h-screen w-full flex relative overflow-hidden font-sans transition-colors duration-300 bg-coop-light" data-step={step}>
      {/* Left Panel - Branding */}
      <BrandingPanel />

      {/* Right Panel - System/Role Selection */}
      <div className="selector-workspace">
        <div className="selector-content">
          {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {/* Module Selection Step */}
          {step === "MODULE_SELECTION" && (
            <ModuleSelection
              systems={systems}
              onSystemSelect={handleSystemSelect}
            />
          )}

          {/* Role Selection Step */}
          {step === "ROLE_SELECTION" && (
            <RoleSelection
              selectedSystem={selectedSystem}
              systems={systems}
              roles={getRolesForSystem(selectedSystem)}
              onRoleSelect={handleRoleSelect}
              onBack={handleBack}
            />
          )}

          {/* Admin Login Form */}
          {step === "ADMIN_LOGIN" && (
            <LoginForm
              type="admin"
              selectedSystem={selectedSystem}
              systems={systems}
              loginData={adminLoginData}
              setLoginData={setAdminLoginData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              onSubmit={handleAdminLogin}
              onBack={handleBack}
            />
          )}

          {/* Secretary Login Form */}
          {step === "SECRETARY_LOGIN" && (
            <LoginForm
              type="secretary"
              selectedSystem={selectedSystem}
              systems={systems}
              loginData={secretaryLoginData}
              setLoginData={setSecretaryLoginData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              onSubmit={handleSecretaryLogin}
              onBack={handleBack}
            />
          )}

          {/* Treasurer Login Form */}
          {step === "MORTUARY_LOGIN" && (
            <LoginForm
              type="mortuary"
              selectedSystem={selectedSystem}
              systems={systems}
              loginData={treasurerLoginData}
              setLoginData={setTreasurerLoginData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              onSubmit={handleTreasurerLogin}
              onBack={handleBack}
            />
          )}

          {/* Scanner Operator Login Form */}
          {step === "OPERATOR_LOGIN" && (
            <LoginForm
              type="scanner_operator"
              selectedSystem={selectedSystem}
              systems={systems}
              loginData={operatorLoginData}
              setLoginData={setOperatorLoginData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              onSubmit={handleOperatorLogin}
              onBack={handleBack}
            />
          )}

          {/* Terminal Footer Info */}
          <TerminalFooter compact={step === 'MODULE_SELECTION'} />
        </div>
      </div>
    </div>
  );
}
