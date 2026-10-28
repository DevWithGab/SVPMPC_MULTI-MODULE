import { useId } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, LoaderCircle, ShieldCheck, User, Wallet, QrCode } from 'lucide-react';

const roles = { admin: 'Administrator', secretary: 'Secretary', scanner_operator: 'Scanner Operator' };

export default function LoginForm({
  type = 'admin', selectedSystem, systems, loginData, setLoginData,
  showPassword, setShowPassword, loginLoading, loginError, onSubmit, onBack,
}) {
  const id = useId();
  const system = systems.find((item) => item.id === selectedSystem);
  const isMortuary = type === 'mortuary';
  const ModuleIcon = isMortuary ? Wallet : QrCode;

  return (
    <Motion.div className="entry-login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <button className="entry-login-back" type="button" onClick={onBack} disabled={loginLoading}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back to System Selection
      </button>
      <header className="entry-login-heading">
        <span className="entry-login-module-icon"><ModuleIcon size={32} aria-hidden="true" /></span>
        <p className="entry-login-eyebrow">{system?.title || 'Staff access'}</p>
        <h1>Welcome back.</h1>
        <p className="entry-login-subtitle">{isMortuary || type === 'attendance' ? 'Sign in to your account to continue.' : `Sign in as ${roles[type] || 'staff'} to continue.`}</p>
      </header>
      <form className="entry-login-form" onSubmit={onSubmit} aria-label={`${system?.title || 'Staff'} sign in`} aria-busy={loginLoading}>
        <div className="entry-login-field">
          <label htmlFor={`${id}-username`}>Username</label>
          <div className="entry-login-input">
            <User size={19} aria-hidden="true" />
            <input id={`${id}-username`} name="username" type="text" value={loginData.username}
              onChange={(event) => setLoginData({ ...loginData, username: event.target.value })}
              placeholder="Enter your username" autoComplete="username" autoCapitalize="none" spellCheck={false}
              required disabled={loginLoading} />
          </div>
        </div>
        <div className="entry-login-field">
          <label htmlFor={`${id}-password`}>Password</label>
          <div className="entry-login-input">
            <Lock size={19} aria-hidden="true" />
            <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} value={loginData.password}
              onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
              placeholder="Enter your password" autoComplete="current-password" required disabled={loginLoading} />
            <button className="entry-login-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)}
              disabled={loginLoading} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls={`${id}-password`}>
              {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {loginError && <p className="entry-login-error" role="alert">{loginError}</p>}
        <button className="entry-login-submit" type="submit" disabled={loginLoading}>
          {loginLoading ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> Signing in…</> : <>Sign in <ArrowRight size={20} aria-hidden="true" /></>}
        </button>
      </form>
      <p className="entry-login-help">{isMortuary || type === 'attendance'
        ? 'Use your staff account. Your assigned role determines your workspace.'
        : 'Need help signing in? Contact your administrator.'}</p>
      <div className="entry-login-admin">
        <a href="/super-admin"><ShieldCheck size={16} aria-hidden="true" /> Super Admin Access <ArrowRight size={15} aria-hidden="true" /></a>
      </div>
    </Motion.div>
  );
}
