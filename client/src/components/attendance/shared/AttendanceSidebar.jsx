import React, { useEffect, useContext } from 'react';
import { UrlStateContext } from '../../../hooks/urlStateContext';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, UserRound, X } from 'lucide-react';
import '../../shared/layout/PortalShell.css';
import './AttendanceWorkspace.css';

const NAVIGATION_ID = 'attendance-navigation';

/* Kapareho ng navigation shell ng mortuary portals (PortalShell.css), para
pare-pareho ang itsura ng Admin, Secretary at Scanner Operator. */
export default function AttendanceSidebar({
  items,
  activeId,
  onSelect,
  roleLabel,
  userName,
  onBack,
  isDesktop,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) {
  const embedded = useContext(UrlStateContext).tab === 'feature';
  const navigationCollapsed = isDesktop && collapsed;
  const hidden = !isDesktop && !mobileOpen;

  useEffect(() => {
    if (!mobileOpen || isDesktop) return undefined;
    const previousFocus = document.activeElement;
    const frame = requestAnimationFrame(() => document.querySelector(`#${NAVIGATION_ID} .mt-close-menu`)?.focus());
    return () => { cancelAnimationFrame(frame); previousFocus?.focus?.(); };
  }, [mobileOpen, isDesktop]);

  if (embedded) return null;
  return <>
    {mobileOpen && !isDesktop && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={onCloseMobile} />}
    <Motion.aside
      id={NAVIGATION_ID}
      aria-label="Attendance navigation"
      aria-hidden={hidden ? true : undefined}
      inert={hidden ? true : undefined}
      initial={false}
      animate={{ width: isDesktop ? (collapsed ? 76 : 296) : (mobileOpen ? 296 : 0) }}
      transition={{ type: 'tween', duration: 0.2 }}
      className="mt-sidebar flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 overflow-hidden print:hidden"
    >
      <div className={`mt-brand ${navigationCollapsed ? 'mt-brand-collapsed' : ''}`}>
        <img src="/SVPMPC-LOGO(MAIN).png" alt="SVPMPC Logo" className="mt-brand-logo" />
        <AnimatePresence mode="wait">
          {!navigationCollapsed && <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="min-w-0">
            <p className="mt-brand-name">SVPMPC</p>
            <p className="mt-brand-description">Saint Vincent Parish<br />Multi-Purpose Cooperative</p>
          </Motion.div>}
        </AnimatePresence>
      </div>

      {!navigationCollapsed && <p className="mt-nav-label">Attendance management</p>}
      {!isDesktop && <button type="button" className="mt-close-menu" aria-label="Close menu" onClick={onCloseMobile}><X size={20} aria-hidden="true" /></button>}

      <nav className="mt-nav" aria-label={`${roleLabel} workspace`}>
        {items.map(({ id, label, icon, badgeCount = 0, badgeLabel = 'pending' }) => <button
          key={id}
          type="button"
          onClick={() => { onSelect(id); if (!isDesktop) onCloseMobile(); }}
          title={navigationCollapsed ? `${label}${badgeCount > 0 ? ` (${badgeCount} ${badgeLabel})` : ''}` : undefined}
          aria-label={badgeCount > 0 ? `${label}, ${badgeCount} ${badgeLabel}` : label}
          aria-current={activeId === id ? 'page' : undefined}
          className={`mt-nav-item ${navigationCollapsed ? 'mt-nav-item-collapsed' : ''}`}
        >
          {React.createElement(icon, { 'aria-hidden': true })}
          {!navigationCollapsed && <span>{label}</span>}
          {badgeCount > 0 && <span aria-hidden="true" className={`mt-nav-badge ${navigationCollapsed ? 'mt-nav-badge-collapsed' : ''}`}>{badgeCount.toLocaleString('en-PH')}</span>}
        </button>)}
      </nav>

      <div className="mt-account">
        {!navigationCollapsed ? <details>
          <summary><UserRound size={26} aria-hidden="true" /><span>{roleLabel}</span><ChevronDown size={18} aria-hidden="true" /></summary>
          <div className="mt-account-details"><p>{userName || roleLabel}</p>{onBack && <button type="button" onClick={onBack} aria-label="Sign Out"><LogOut size={18} aria-hidden="true" />Sign Out</button>}</div>
        </details> : onBack && <button type="button" onClick={onBack} aria-label="Sign Out" title="Sign Out"><LogOut size={20} aria-hidden="true" /></button>}
      </div>

      {isDesktop && <button type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="mt-collapse">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>}
    </Motion.aside>
  </>;
}

export function AttendanceMobileBar({ mobileOpen, onOpen }) {
  const embedded = useContext(UrlStateContext).tab === 'feature';
  if (embedded) return null;
  return <div className="mt-mobile-bar lg:hidden flex items-center justify-between shrink-0 print:hidden">
    <button type="button" onClick={onOpen} aria-label="Open menu" aria-expanded={mobileOpen} aria-controls={NAVIGATION_ID} className="mt-menu-button"><Menu size={22} aria-hidden="true" /></button>
    <div className="text-center"><p className="font-semibold text-base">SVPMPC</p><p className="text-xs">Attendance management</p></div>
    <div className="w-10 h-10" />
  </div>;
}
