import React from 'react';
import './AttendanceMetricGrid.css';

export default function AttendanceMetricGrid({ items, label, busy = false }) {
  return <section className="attendance-metric-grid" aria-label={label} aria-busy={busy}>
    {items.map(([title, value, detail, Icon]) => <div className="attendance-metric" key={title}>
      <div className="attendance-metric-heading"><p>{title}</p>{Icon && <span className="attendance-metric-icon"><Icon size={15} strokeWidth={1.8} aria-hidden="true" /></span>}</div>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </div>)}
  </section>;
}
