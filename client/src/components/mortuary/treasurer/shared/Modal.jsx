import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-coop-darkGreen/40 backdrop-blur-md" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.9, y: 20 }} 
          className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-900/10 w-full max-w-lg relative z-10 border border-slate-200/70 max-h-[90dvh] flex flex-col overflow-hidden"
        >
          <div className="px-8 pt-8 pb-6 flex justify-between items-start gap-6 relative z-10 shrink-0 border-b border-slate-100 bg-linear-to-b from-white to-slate-50/70">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-coop-green">
                <Sparkles className="w-3 h-3" />
                Treasurer Form
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tighter leading-none">{title}</h3>
                <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
                  Review the details below before saving the record.
                </p>
              </div>
              <div className="h-1 w-14 bg-coop-green rounded-full" />
            </div>
            <button 
              onClick={onClose} 
              aria-label="Close modal"
              className="w-11 h-11 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:text-rose-600 hover:shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-8 pb-8 pt-6 relative z-10 overflow-y-auto custom-scrollbar bg-slate-50/30">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default Modal;