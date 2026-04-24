import { motion } from 'framer-motion';

export default function FeatureCard({
  icon: IconComponent,
  label,
  className = '',
  variant = 'glass', // 'glass', 'solid', 'outline'
  ...props
}) {
  const variants = {
    glass: 'bg-white/10 backdrop-blur-sm border border-white/10 hover:border-coop-yellow/30',
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
      whileHover={{ y: -4, borderColor: variant === 'glass' ? 'rgba(245, 194, 72, 0.3)' : 'rgba(45, 122, 62, 1)' }}
      {...props}
    >
      {IconComponent && (
        <IconComponent className={`
          h-6 w-6 mb-2
          ${variant === 'glass' ? 'text-coop-yellow' : 'text-coop-green'}
        `} />
      )}
      <span className={`
        font-semibold text-sm
        ${variant === 'glass' ? 'text-white' : 'text-slate-900'}
      `}>
        {label}
      </span>
    </motion.div>
  );
}