import { motion } from 'framer-motion';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: IconComponent,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-2 whitespace-nowrap focus:outline-none';
  
  const variants = {
    primary: 'bg-coop-green hover:bg-coop-darkGreen text-white shadow-md hover:shadow-lg',
    secondary: 'bg-slate-200 hover:bg-slate-300 text-slate-900',
    ghost: 'text-slate-600 hover:text-coop-green hover:bg-slate-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };

  const sizes = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-11 px-4',
    lg: 'h-12 px-6 text-lg'
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed';

  const buttonClasses = `
    ${baseClasses}
    ${variants[variant]}
    ${sizes[size]}
    ${disabled ? disabledClasses : ''}
    ${className}
  `.trim();

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={buttonClasses}
      whileHover={!disabled && !loading ? { y: -1 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      {...props}
    >
      {IconComponent && <IconComponent className="w-4 h-4" />}
      {loading ? 'Loading...' : children}
    </motion.button>
  );
}