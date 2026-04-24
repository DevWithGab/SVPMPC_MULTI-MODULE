// ===== EXAMPLE: How Props Work =====

import { User, Shield } from 'lucide-react';

// 1. COMPONENT DEFINITION
function CooperativeLogo({ icon: IconComponent, showLogo = false }) {
  return (
    <div>
      {showLogo ? (
        <img src="/logo.png" alt="Logo" />
      ) : IconComponent ? (
        <IconComponent className="w-12 h-12 text-green-600" />
      ) : null}
    </div>
  );
}

// 2. CONFIGURATION OBJECT
const config = {
  member: {
    icon: User,    // This is the actual User component from lucide-react
    title: 'Member Access'
  },
  admin: {
    icon: Shield,  // This is the actual Shield component from lucide-react
    title: 'Administrator Access'
  }
};

// 3. USAGE IN PARENT COMPONENT
function LoginForm({ type }) {
  // type can be "member" or "admin"
  const currentConfig = config[type];
  
  return (
    <div>
      {/* This passes the icon component as a prop */}
      <CooperativeLogo icon={currentConfig.icon} />
      <h2>{currentConfig.title}</h2>
    </div>
  );
}

// 4. WHAT ACTUALLY HAPPENS:

// When type = "member":
// currentConfig = { icon: User, title: 'Member Access' }
// <CooperativeLogo icon={User} />
// Inside CooperativeLogo: IconComponent = User
// Renders: <User className="w-12 h-12 text-green-600" />

// When type = "admin":
// currentConfig = { icon: Shield, title: 'Administrator Access' }
// <CooperativeLogo icon={Shield} />
// Inside CooperativeLogo: IconComponent = Shield  
// Renders: <Shield className="w-12 h-12 text-green-600" />

export { CooperativeLogo, LoginForm };