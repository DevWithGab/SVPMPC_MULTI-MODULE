import { motion } from 'framer-motion';

export default function ImageCard({
  src,
  alt,
  title,
  subtitle,
  className = '',
  overlayGradient = 'from-black/60 to-transparent',
  ...props
}) {
  return (
    <motion.div 
      className={`
        relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 max-w-md
        ${className}
      `.trim()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      whileHover={{ scale: 1.02 }}
      {...props}
    >
      <img 
        src={src}
        alt={alt}
        className="w-full h-48 object-cover"
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${overlayGradient}`} />
      {(title || subtitle) && (
        <div className="absolute bottom-4 left-4 right-4">
          {title && <p className="text-white font-semibold">{title}</p>}
          {subtitle && <p className="text-white/70 text-sm">{subtitle}</p>}
        </div>
      )}
    </motion.div>
  );
}