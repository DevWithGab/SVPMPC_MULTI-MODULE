import React, { useEffect, useId, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/* Yung `maxWidth` ay kumukuha ng isang Tailwind max-w-* class (default
max-w-md) - hiniwalay sa sariling prop imbes na i-fold sa `className` para
yung caller na nag-widen ng modal (e.g. maxWidth="max-w-2xl") ay hindi
magkaroon ng two conflicting max-w-* utility classes sa same element, na
hindi reliably resolved ng Tailwind by DOM order. Si `className` naman ay
para sa ibang bagay. */
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md', className = '', accessible = false }) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen || !accessible) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [isOpen, accessible]);
  return (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <Motion.div
          ref={dialogRef}
          role={accessible ? 'dialog' : undefined}
          aria-modal={accessible ? true : undefined}
          aria-labelledby={accessible ? titleId : undefined}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`bg-white w-full ${maxWidth} relative z-10 border border-slate-200 max-h-[90dvh] flex flex-col overflow-hidden ${className}`}
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 shrink-0">
            <h3 id={titleId} className="text-base font-bold text-slate-900">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Content */}
          <div className="px-6 py-5 overflow-y-auto">
            {children}
          </div>
        </Motion.div>
      </div>
    )}
  </AnimatePresence>
);
};

export default Modal;
