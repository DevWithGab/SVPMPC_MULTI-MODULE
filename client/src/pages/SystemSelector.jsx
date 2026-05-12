import { useState, useEffect } from "react";
import {
  Database,
  QrCode,
  User,
  UserCheck,
  Shield,
  ClipboardList,
  Calculator,
} from "lucide-react";

// Import our new components
import BrandingPanel from "../components/shared/BrandingPanel";
import ModuleSelection from "../components/shared/ModuleSelection";
import RoleSelection from "../components/shared/RoleSelection";
import LoginForm from "../components/shared/LoginForm";
import TerminalFooter from "../components/shared/TerminalFooter";

// API Base URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

export default function SystemSelector({ onModuleSelect }) {
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [step, setStep] = useState("MODULE_SELECTION"); // MODULE_SELECTION, ROLE_SELECTION, MEMBER_LOGIN, ADMIN_LOGIN, SECRETARY_LOGIN, TREASURER_LOGIN
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [adminLoginData, setAdminLoginData] = useState({
    email: "",
    password: "",
  });
  const [secretaryLoginData, setSecretaryLoginData] = useState({
    email: "",
    password: "",
  });
  const [treasurerLoginData, setTreasurerLoginData] = useState({
    email: "",
    password: "",
  });
  const [operatorLoginData, setOperatorLoginData] = useState({
    email: "",
    password: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // Clear any existing mock authentication data on component mount
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  const systems = [
    {
      id: "mortuary",
      title: "Mortuary Services",
      description: "Manage funds & contribution",
      icon: Database,
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
      description: "Generate QR & track events",
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
      // Add member role for attendance
      baseRoles.unshift({
        id: "member",
        title: "Member",
        description: "Access member services",
        icon: User,
        code: "MBR",
      });
      // Add secretary role
      baseRoles.splice(1, 0, {
        id: "secretary",
        title: "Secretary",
        description: "Manage events & attendance",
        icon: ClipboardList,
        code: "SEC",
      });
      baseRoles.splice(2, 0, {
        id: "scanner_operator",
        title: "Scanner Operator",
        description: "Scan attendance QR codes",
        icon: UserCheck,
        code: "SOP",
      });
    } else if (systemId === "mortuary") {
      // Only treasurer and admin for mortuary
      baseRoles.unshift({
        id: "treasurer",
        title: "Treasurer / Staff",
        description: "Manage fund & contributions",
        icon: Calculator,
        code: "TRS",
      });
    }

    return baseRoles;
  };

  const handleSystemSelect = (systemId) => {
    setSelectedSystem(systemId);
    setStep("ROLE_SELECTION");
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    if (roleId === "member") {
      setStep("MEMBER_LOGIN");
    } else if (roleId === "admin") {
      setStep("ADMIN_LOGIN");
    } else if (roleId === "secretary") {
      setStep("SECRETARY_LOGIN");
    } else if (roleId === "scanner_operator") {
      setStep("OPERATOR_LOGIN");
    } else if (roleId === "treasurer") {
      setStep("TREASURER_LOGIN");
    }
  };

  const handleMemberLogin = async (e) => {
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
          username: loginData.email,
          password: loginData.password,
          expectedRole: "member",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(selectedSystem, "member", data.user, data.token);
        }

        // Reset form
        setLoginData({ email: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (error) {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
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
          username: adminLoginData.email,
          password: adminLoginData.password,
          expectedRole: selectedRole || "admin",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

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
        setAdminLoginData({ email: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (error) {
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
          username: secretaryLoginData.email,
          password: secretaryLoginData.password,
          expectedRole: "secretary",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(selectedSystem, "secretary", data.user, data.token);
        }

        // Reset form
        setSecretaryLoginData({ email: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (error) {
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
          username: operatorLoginData.email,
          password: operatorLoginData.password,
          expectedRole: "scanner_operator",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        if (onModuleSelect) {
          onModuleSelect(
            selectedSystem,
            data.user.role || "scanner_operator",
            data.user,
            data.token,
          );
        }

        setOperatorLoginData({ email: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (error) {
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
          username: treasurerLoginData.email,
          password: treasurerLoginData.password,
          expectedRole: "treasurer",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Call the parent callback to navigate to the appropriate portal
        if (onModuleSelect) {
          onModuleSelect(selectedSystem, "treasurer", data.user, data.token);
        }

        // Reset form
        setTreasurerLoginData({ email: "", password: "" });
        setShowPassword(false);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (error) {
      setLoginError(
        "Network error. Please check your connection and try again.",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBack = () => {
    if (
      step === "MEMBER_LOGIN" ||
      step === "ADMIN_LOGIN" ||
      step === "SECRETARY_LOGIN" ||
      step === "TREASURER_LOGIN" ||
      step === "OPERATOR_LOGIN"
    ) {
      setStep("ROLE_SELECTION");
      setLoginError("");
      setLoginData({ email: "", password: "" });
      setAdminLoginData({ email: "", password: "" });
      setSecretaryLoginData({ email: "", password: "" });
      setTreasurerLoginData({ email: "", password: "" });
      setOperatorLoginData({ email: "", password: "" });
      setShowPassword(false);
    } else if (step === "ROLE_SELECTION") {
      setStep("MODULE_SELECTION");
      setSelectedSystem(null);
      setSelectedRole(null);
    }

    // Clear any stored authentication data when going back
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden font-sans transition-colors duration-300 bg-coop-light">
      {/* Left Panel - Branding */}
      <BrandingPanel />

      {/* Right Panel - System/Role Selection */}
      <div className="w-full lg:w-[45%] bg-slate-50 p-6 md:p-12 lg:p-20 flex flex-col h-full overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
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

          {/* Member Login Form */}
          {step === "MEMBER_LOGIN" && (
            <LoginForm
              type="member"
              selectedSystem={selectedSystem}
              systems={systems}
              loginData={loginData}
              setLoginData={setLoginData}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              onSubmit={handleMemberLogin}
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
          {step === "TREASURER_LOGIN" && (
            <LoginForm
              type="treasurer"
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
          <TerminalFooter />
        </div>
      </div>
    </div>
  );
}
