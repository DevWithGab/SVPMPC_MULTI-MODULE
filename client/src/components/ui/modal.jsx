import React, { useEffect, useId, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { DialogHeader } from './workspace';
import './design-system.css';

const openDialogs = [];
let previousBodyOverflow = '';
const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const focusableItems = panel => [...(panel?.querySelectorAll(focusableSelector) || [])]
  .filter(element => !element.closest('[hidden], [inert], [aria-hidden="true"]'));

const Modal = ({ isOpen, onClose, title, description, children, footer, maxWidth, className = '', closeLabel = 'Close dialog' }) => {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    if (!openDialogs.length) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.push(titleId);
    const focusTimer = setTimeout(() => {
      if (openDialogs.at(-1) !== titleId) return;
      (focusableItems(panelRef.current)[0] || panelRef.current)?.focus();
    }, 0);
    const keydown = event => {
      if (openDialogs.at(-1) !== titleId) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const items = focusableItems(panelRef.current);
      if (!items.length) { event.preventDefault(); panelRef.current?.focus(); return; }
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', keydown, true);
      const index = openDialogs.lastIndexOf(titleId);
      if (index !== -1) openDialogs.splice(index, 1);
      if (!openDialogs.length) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, titleId]);

  // Legacy callers often pass a max-w-* utility in className.
  const width = maxWidth || (/(?:^|\s)max-w-/.test(className) ? '' : 'max-w-lg');
  return <AnimatePresence>{isOpen && <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
    <Motion.div className="absolute inset-0 bg-[#112017]/45" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }} />
    <Motion.div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined} tabIndex={-1}
      className={cn('ui-dialog relative flex w-full max-h-[90dvh] flex-col overflow-hidden outline-none', width, className)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: .15 }}>
      {title && <DialogHeader title={title} titleId={titleId} description={description} descriptionId={descriptionId} onClose={onClose} closeLabel={closeLabel} />}
      <div className="ui-dialog-body">{children}</div>
      {footer}
    </Motion.div>
  </div>}</AnimatePresence>;
};

export { Modal };
export default Modal;