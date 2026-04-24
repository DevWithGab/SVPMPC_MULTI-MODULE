import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

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

  const currentConfig = config[type] || config.info;
  const IconComponent = currentConfig.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className={`fixed top-4 right-4 z-50 ${currentConfig.bgColor} ${currentConfig.borderColor} ${currentConfig.textColor} border rounded-2xl p-4 shadow-lg max-w-sm`}
      >
        <div className="flex items-start gap-3">
          <IconComponent className={`w-5 h-5 ${currentConfig.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1">
            <p className="text-sm font-bold">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};