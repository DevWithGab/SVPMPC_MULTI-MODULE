import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input as SharedInput } from '../../ui/input';
import { FormField } from '../../ui/workspace';

export default function Input({ label, type = 'text', disabled = false, required = false, icon: Icon, showPasswordToggle = false, error, className = '', autoComplete, id, ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;
  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;
  const describedBy = [props['aria-describedby'], error ? `${inputId}-error` : null].filter(Boolean).join(' ') || undefined;
  return <FormField id={inputId} label={label} required={required} error={error}>
    <div className="ui-input-group" data-icon={Boolean(Icon)} data-toggle={showPasswordToggle}>
      {Icon && <span className="ui-input-icon"><Icon size={16} aria-hidden="true" /></span>}
      <SharedInput {...props} id={inputId} type={inputType} disabled={disabled} required={required}
        autoComplete={autoComplete ?? (inputType === 'password' ? 'current-password' : undefined)}
        aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy} className={className} />
      {showPasswordToggle && <button type="button" className="ui-input-toggle" onClick={() => setShowPassword(value => !value)} disabled={disabled} aria-label={showPassword ? 'Hide password' : 'Show password'}>
        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>}
    </div>
  </FormField>;
}