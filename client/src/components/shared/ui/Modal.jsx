import React from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-950 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;