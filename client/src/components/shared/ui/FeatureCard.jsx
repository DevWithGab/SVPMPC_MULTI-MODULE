import { motion } from 'framer-motion';

export default function FeatureCard({
  icon: IconComponent,
  label,
  description,
  className = '',
  variant = 'glass', // 'glass', 'solid', 'outline'
  ...props
}) {
  const variants = {
    glass: 'bg-white/5 backdrop-blur-sm border border-white/10 hover:border-coop-yellow/30',
    solid: 'bg-white border border-slate-200 hover:border-coop-green shadow-sm',
    outline: 'border-2 border-slate-200 hover:border-coop-green bg-transparent'
  };

  return (
    <motion.div
      className={`
        ${variants[variant]}
        rounded-xl p-4 transition-all cursor-pointer
        ${className}
      `.trim()}
      whileHover={{ y: -4, borderColor: variant === 'glass' ? 'rgba(242, 228, 22, 0.3)' : 'rgba(45, 122, 62, 1)' }}
      {...props}
    >
      {IconComponent && (
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center mb-3
          ${variant === 'glass' ? 'bg-coop-yellow/15 border border-coop-yellow/20' : 'bg-coop-green/10'}
        `}>
          <IconComponent className={`
            h-5 w-5
            ${variant === 'glass' ? 'text-coop-yellow' : 'text-coop-green'}
          `} />
        </div>
      )}
      <span className={`
        block font-semibold text-sm tracking-wide uppercase
        ${variant === 'glass' ? 'text-white' : 'text-slate-900'}
      `}>
        {label}
      </span>
      {description && (
        <p className={`
          mt-1 text-xs leading-relaxed
          ${variant === 'glass' ? 'text-white/60' : 'text-slate-500'}
        `}>
          {description}
        </p>
      )}
    </motion.div>
  );
}
