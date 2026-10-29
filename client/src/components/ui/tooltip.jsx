import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './tooltip.css';

// Render outside scrollable tables so action hints are never clipped by a row.
export function Tooltip({ content, children }) {
  const id = useId();
  const [position, setPosition] = useState(null);
  const closeTimer = useRef(null);
  const keepOpen = () => clearTimeout(closeTimer.current);
  const closeSoon = () => {
    keepOpen();
    closeTimer.current = setTimeout(() => setPosition(null), 120);
  };
  const show = event => {
    if (event.pointerType === 'touch') return;
    keepOpen();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    setPosition({
      left: Math.max(width / 2 + 12, Math.min(rect.left + rect.width / 2, window.innerWidth - width / 2 - 12)),
      top: rect.bottom + 140 > window.innerHeight ? rect.top - 8 : rect.bottom + 8,
      above: rect.bottom + 140 > window.innerHeight,
    });
  };
  const open = Boolean(position);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => setPosition(null);
    const onKey = event => { if (event.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const props = children.props;
  const Trigger = children.type;
  return <><Trigger {...props}
    aria-describedby={[props['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined}
    onPointerEnter={event => { props.onPointerEnter?.(event); show(event); }}
    onPointerLeave={event => { props.onPointerLeave?.(event); closeSoon(); }}
    onFocus={event => { props.onFocus?.(event); show(event); }}
    onBlur={event => { props.onBlur?.(event); closeSoon(); }}
    onClick={event => { keepOpen(); setPosition(null); props.onClick?.(event); }}
  />{open && createPortal(<div id={id} role="tooltip" className="ui-tooltip" style={{ left: position.left, top: position.top, transform: position.above ? 'translate(-50%, -100%)' : 'translateX(-50%)' }} onPointerEnter={keepOpen} onPointerLeave={closeSoon}>{content}</div>, document.body)}</>;
}
