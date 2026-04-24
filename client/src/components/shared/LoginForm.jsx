import { motion } from 'framer-motion';
import { Mail, Lock, User, Shield, ClipboardList, Calculator } from 'lucide-react';
import CooperativeLogo from './CooperativeLogo';
import { Input, Button, BackButton, Alert } from './ui';

export default function LoginForm({
  type = 'member', // 'member', 'admin', 'secretary', or 'treasurer'
  selectedSystem,
  systems,
  loginData,
  setLoginData,
  showPassword,
  setShowPassword,
  loginLoading,
  loginError,
  onSubmit,
  onBack
}) {
  const selectedSystemData = systems.find(s => s.id === selectedSystem);
  
  const config = {
    member: {
      icon: User,
      title: 'Member Access',
      subtitle: `Sign in to access ${selectedSystemData?.title}`,
      emailLabel: 'Username',
      passwordLabel: 'Password',
      emailPlaceholder: 'Enter your username',
      passwordPlaceholder: 'Enter your password',
      buttonText: 'Sign In',
      buttonIcon: User,
      helpText: 'Need help? Contact your cooperative administrator'
    },
    admin: {
      icon: Shield,
      title: 'Administrator Access',
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      emailLabel: 'Admin Email',
      passwordLabel: 'Admin Password',
      emailPlaceholder: 'Enter admin email address',
      passwordPlaceholder: 'Enter admin password',
      buttonText: 'Admin Sign In',
      buttonIcon: Shield,
      helpText: 'Authorized personnel only • Contact IT support for assistance'
    },
    secretary: {
      icon: ClipboardList,
      title: 'Secretary Access',
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      emailLabel: 'Secretary Email',
      passwordLabel: 'Secretary Password',
      emailPlaceholder: 'Enter secretary email address',
      passwordPlaceholder: 'Enter secretary password',
      buttonText: 'Secretary Sign In',
      buttonIcon: ClipboardList,
      helpText: 'Secretary access • Contact administrator for assistance'
    },
    treasurer: {
      icon: Calculator,
      title: 'Treasurer / Staff Access',
      subtitle: `Sign in to manage ${selectedSystemData?.title}`,
      emailLabel: 'Treasurer Email',
      passwordLabel: 'Treasurer Password',
      emailPlaceholder: 'Enter treasurer email address',
      passwordPlaceholder: 'Enter treasurer password',
      buttonText: 'Treasurer Sign In',
      buttonIcon: Calculator,
      helpText: 'Treasurer access • Contact administrator for assistance'
    }
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
      <BackButton onClick={onBack}>
        Back to Role Selection
      </BackButton>

      {/* Professional Logo Branding */}
      <CooperativeLogo icon={currentConfig.icon} />

      {/* Login Subtitle */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2 className="text-xl font-bold text-slate-900 mb-2">{currentConfig.title}</h2>
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
            label={currentConfig.emailLabel}
            type="text"
            value={loginData.email}
            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            placeholder={currentConfig.emailPlaceholder}
            icon={Mail}
            required
            disabled={loginLoading}
          />

          {/* Password Input */}
          <Input
            label={currentConfig.passwordLabel}
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            placeholder={currentConfig.passwordPlaceholder}
            icon={Lock}
            showPasswordToggle
            required
            disabled={loginLoading}
          />

          {/* Error Alert */}
          {loginError && (
            <Alert
              type="error"
              message={loginError}
            />
          )}

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
          <p className="text-sm text-slate-500">
            {currentConfig.helpText}
          </p>
        </div>

        {/* Super Admin Link - Subtle Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Shield className="w-3 h-3" />
            <button
              type="button"
              onClick={() => window.location.href = '/super-admin'}
              className="hover:text-emerald-600 transition-colors font-medium"
            >
              Super Admin Access
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}