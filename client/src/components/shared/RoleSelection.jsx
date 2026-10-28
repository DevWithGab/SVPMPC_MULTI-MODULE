import { motion as Motion } from 'framer-motion';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export default function RoleSelection({ selectedSystem, systems, roles, onRoleSelect, onBack }) {
  const selectedSystemData = systems.find(system => system.id === selectedSystem);
  const SystemIcon = selectedSystemData?.icon;

  return (
    <Motion.section
      className="entry-role-selection"
      aria-labelledby="role-selection-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <button type="button" onClick={onBack} className="entry-login-back">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to modules
      </button>
      <header className="entry-login-heading">
        {SystemIcon && (
          <span className="entry-login-module-icon">
            <SystemIcon size={32} strokeWidth={1.7} aria-hidden="true" />
          </span>
        )}
        <p className="entry-login-eyebrow">{selectedSystemData?.title}</p>
        <h1 id="role-selection-title">Select your role</h1>
        <p className="entry-login-subtitle">Choose your role to sign in to your workspace.</p>
      </header>
      <div className="entry-role-options">
        {roles.map(role => (
          <button key={role.id} type="button" onClick={() => onRoleSelect(role.id)} className="entry-role-option">
            <span className="entry-role-icon">
              <role.icon size={24} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="entry-role-copy">
              <span className="entry-role-title">{role.title}</span>
              <span className="entry-role-description">{role.description}</span>
            </span>
            <ChevronRight className="entry-role-arrow" size={20} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="entry-role-help">Continue with the role assigned to your cooperative account.</p>
    </Motion.section>
  );
}
