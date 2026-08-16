import React, { useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

let modalIdCounter = 0;

const Modal = ({ isOpen, onClose, title, children, className = '' }) => {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleIdRef = useRef(`modal-title-${++modalIdCounter}`);

  // Focus management: remember what had focus, move focus into the dialog
  // on open, and give it back on close (user control & freedom).
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    const focusTimer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || panelRef.current)?.focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      if (
        previouslyFocusedRef.current &&
        typeof previouslyFocusedRef.current.focus === 'function'
      ) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen]);

  // Escape closes; Tab is trapped inside the dialog while it's open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusableEls = panelRef.current.querySelectorAll(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableEls.length === 0) return;

        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <Motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal Content */}
          <Motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleIdRef.current : undefined}
            tabIndex={-1}
            className={`relative bg-white rounded-3xl shadow-2xl w-full mx-4 max-h-[90vh] overflow-y-auto outline-none ${className}`}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl">
                <h2 id={titleIdRef.current} className="text-lg font-black text-slate-950 tracking-tight">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6">
              {children}
            </div>
          </Motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export { Modal };
export default Modal;
