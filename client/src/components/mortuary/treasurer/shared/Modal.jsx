import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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
          className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-lg relative z-10 border border-green-100/50 max-h-[90dvh] flex flex-col overflow-hidden"
        >
          <div className="px-8 pt-8 pb-6 flex justify-between items-center relative z-10 shrink-0">
            <div>
              <h3 className="text-2xl font-black text-slate-950 tracking-tighter">{title}</h3>
              <div className="h-1 w-12 bg-coop-green rounded-full mt-2" />
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-coop-green transition-all"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <div className="px-8 pb-8 relative z-10 overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default Modal;