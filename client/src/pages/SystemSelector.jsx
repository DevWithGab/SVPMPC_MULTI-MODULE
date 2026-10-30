import { useState } from 'react';
import useLoginNavigation from '../hooks/useLoginNavigation';
import { Wallet, QrCode } from 'lucide-react';
import BrandingPanel from '../components/shared/BrandingPanel';
import ModuleSelection from '../components/shared/ModuleSelection';
import LoginForm from '../components/shared/LoginForm';
import TerminalFooter from '../components/shared/TerminalFooter';
import './SystemSelector.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

export default function SystemSelector({ onModuleSelect, notice }) {
  const { selectedSystem, step, selectSystem, back } = useLoginNavigation();
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
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


  const clearForm = () => {
    setLoginData({ username: '', password: '' });
    setLoginError('');
    setShowPassword(false);
  };
  const handleLogin = async event => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const response = await fetch(API_BASE_URL + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loginData, module: selectedSystem }),
      });
      const data = await response.json();
      if (!response.ok) { setLoginError(data.message || 'Invalid credentials'); return; }
      window.sessionStorage.setItem('token', data.token);
      window.sessionStorage.setItem('user', JSON.stringify(data.user));
      const role = data.user.role === 'super_admin'
        ? selectedSystem === 'mortuary' ? 'claims_officer' : 'secretary'
        : data.user.role;
      onModuleSelect?.(selectedSystem, role, data.user, data.token);
      clearForm();
    } catch {
      setLoginError('Network error. Please check your connection and try again.');
    } finally { setLoginLoading(false); }
  };
  const handleBack = () => {
    back(); clearForm();
    window.sessionStorage.removeItem('token');
    window.sessionStorage.removeItem('user');
  };
  return (
    <div className="system-selector min-h-screen w-full flex relative overflow-hidden font-sans transition-colors duration-300 bg-coop-light" data-step={step}>
      <BrandingPanel />
      <div className="selector-workspace"><div className="selector-content">
        {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {step === 'MODULE_SELECTION' ? <ModuleSelection systems={systems} onSystemSelect={system => { clearForm(); selectSystem(system); }} /> :
          <LoginForm type={selectedSystem} selectedSystem={selectedSystem} systems={systems} loginData={loginData} setLoginData={setLoginData}
            showPassword={showPassword} setShowPassword={setShowPassword} loginLoading={loginLoading} loginError={loginError}
            onSubmit={handleLogin} onBack={handleBack} />}
        <TerminalFooter compact={step === 'MODULE_SELECTION'} />
      </div></div>
    </div>
  );
}
