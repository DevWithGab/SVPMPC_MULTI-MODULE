import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  icon: IconComponent,
  showPasswordToggle = false,
  error,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-slate-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <motion.div
        className="relative group"
        whileHover={{ y: -1 }}
        whileFocus={{ y: -1 }}
      >
        {IconComponent && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconComponent className="w-4 h-4 text-slate-400 group-hover:text-coop-green transition-colors" />
          </div>
        )}
        
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full h-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 
            focus:outline-none focus:ring-2 focus:ring-coop-green/20 focus:border-coop-green 
            hover:border-slate-300 transition-all shadow-sm
            ${IconComponent ? 'pl-10' : 'pl-4'}
            ${showPasswordToggle ? 'pr-10' : 'pr-4'}
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${className}
          `.trim()}
          {...props}
        />
        
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-coop-green transition-colors"
            disabled={disabled}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </motion.div>
      
      {error && (
        <motion.p
          className="text-red-600 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}