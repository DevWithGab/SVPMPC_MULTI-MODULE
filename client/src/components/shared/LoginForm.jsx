import { motion } from "framer-motion";
import {
  User,
  Lock,
  UserCheck,
  Shield,
  ClipboardList,
  Calculator,
  LogIn,
} from "lucide-react";
import CooperativeLogo from "./CooperativeLogo";
import { Input, Button, BackButton, Alert } from "./ui";

export default function LoginForm({
  type = "admin", // 'admin', 'secretary', 'treasurer', or 'scanner_operator'
  selectedSystem,
  systems,
  loginData,
  setLoginData,
  showPassword,
  setShowPassword,
  loginLoading,
  loginError,
  onSubmit,
  onBack,
}) {
  const selectedSystemData = systems.find((s) => s.id === selectedSystem);

  const config = {
    admin: {
      icon: Shield,
      title: "Administrator Access",
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      usernameLabel: "Username",
      passwordLabel: "Password",
      usernamePlaceholder: "Enter your username",
      passwordPlaceholder: "Enter admin password",
      buttonText: "Sign In",
      buttonIcon: LogIn,
      helpText: "Authorized personnel only • Contact IT support for assistance",
    },
    secretary: {
      icon: ClipboardList,
      title: "Secretary Access",
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      usernameLabel: "Username",
      passwordLabel: "Password",
      usernamePlaceholder: "Enter your username",
      passwordPlaceholder: "Enter secretary password",
      buttonText: "Sign In",
      buttonIcon: LogIn,
      helpText: "Secretary access • Contact administrator for assistance",
    },
    scanner_operator: {
      icon: UserCheck,
      title: "Scanner Operator Access",
      subtitle: `Sign in to use the QR scanner for ${selectedSystemData?.title}`,
      usernameLabel: "Username",
      passwordLabel: "Password",
      usernamePlaceholder: "Enter your username",
      passwordPlaceholder: "Enter operator password",
      buttonText: "Sign In",
      buttonIcon: LogIn,
      helpText:
        "Scanner operator access • Contact your administrator for assistance",
    },
    mortuary: {
      icon: Calculator,
      title: "Mortuary sign in",
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      usernameLabel: "Username",
      passwordLabel: "Password",
      usernamePlaceholder: "Enter your username",
      passwordPlaceholder: "Enter your password",
      buttonText: "Sign In",
      buttonIcon: LogIn,
      helpText: "Use your staff account. Your assigned role determines your workspace.",
    },
  };

  const currentConfig = config[type];

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Back Button */}
      <BackButton onClick={onBack}>{type === 'mortuary' ? 'Back to System Selection' : 'Back to Role Selection'}</BackButton>

      {/* Professional Logo Branding */}
      <CooperativeLogo icon={currentConfig.icon} />

      {/* Login Subtitle */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {currentConfig.title}
        </h2>
        <p className="text-slate-500 text-sm">{currentConfig.subtitle}</p>
      </motion.div>

      {/* Login Form */}
      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Username Input */}
          <Input
            label={currentConfig.usernameLabel}
            type="text"
            value={loginData.username}
            onChange={(e) =>
              setLoginData({ ...loginData, username: e.target.value })
            }
            placeholder={currentConfig.usernamePlaceholder}
            icon={User}
            required
            disabled={loginLoading}
            autoComplete="username"
          />

          {/* Password Input */}
          <Input
            label={currentConfig.passwordLabel}
            type="password"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            placeholder={currentConfig.passwordPlaceholder}
            icon={Lock}
            showPasswordToggle
            required
            disabled={loginLoading}
            autoComplete="current-password"
          />

          {/* Error Alert */}
          {loginError && <Alert type="error" message={loginError} />}

          {/* Sign In Button */}
          <Button
            type="submit"
            disabled={loginLoading}
            loading={loginLoading}
            icon={currentConfig.buttonIcon}
            className="w-full mt-6"
          >
            {currentConfig.buttonText}
          </Button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">{currentConfig.helpText}</p>
        </div>

        {/* Super Admin Link - Subtle Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="w-3 h-3" />
            <button
              type="button"
              onClick={() => (window.location.href = "/super-admin")}
              className="py-1 hover:text-emerald-600 transition-colors font-medium"
            >
              Super Admin Access
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
