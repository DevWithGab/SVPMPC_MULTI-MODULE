import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

export const Alert = ({
  type = 'info', // 'success', 'error', 'warning', 'info'
  title,
  message,
  className = '',
  children,
  ...props
}) => {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      iconColor: 'text-red-500'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-500'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-500'
    }
  };

  const currentConfig = config[type];
  const IconComponent = currentConfig.icon;

  return (
    <motion.div
      className={`
        ${currentConfig.bgColor} ${currentConfig.borderColor} ${currentConfig.textColor}
        border rounded-lg p-4 flex items-start gap-3
        ${className}
      `.trim()}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      {...props}
    >
      {children || (
        <>
          <IconComponent className={`w-5 h-5 ${currentConfig.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            {title && <h4 className="font-semibold mb-1">{title}</h4>}
            <p className="text-sm">{message}</p>
          </div>
        </>
      )}
    </motion.div>
  );
};

export const AlertDescription = ({ children, className = '', ...props }) => (
  <div className={`text-sm ${className}`} {...props}>
    {children}
  </div>
);

// Keep default export for backward compatibility
export default Alert;