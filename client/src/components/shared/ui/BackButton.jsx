import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({
  onClick,
  children = 'Back',
  className = '',
  ...props
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        flex items-center text-slate-600 hover:text-coop-green transition-colors mb-6
        ${className}
      `.trim()}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      {...props}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {children}
    </motion.button>
  );
}