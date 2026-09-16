import React from 'react';

const COLOR_STYLES = {
  emerald: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-600', ring: 'border-green-300 ring-green-400/30' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', ring: 'border-blue-300 ring-blue-400/30' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', ring: 'border-amber-300 ring-amber-400/30' },
  rose: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-500', ring: 'border-red-300 ring-red-400/30' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', ring: 'border-slate-300 ring-slate-400/30' },
};

// Renders as a plain card by default. Pass `onClick` to turn it into a
// keyboard-accessible quick filter (e.g. "click this stat to filter the table by it"),
// and `active` to reflect whether that filter is currently applied.
const StatCard = ({ title, value, subtitle, icon: Icon, color = 'emerald', onClick, active = false }) => {
  const c = COLOR_STYLES[color] || COLOR_STYLES.emerald;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={`w-full text-left bg-white border rounded-xl p-5 flex items-start gap-4 transition-all ${
        active ? `ring-1 ${c.ring}` : 'border-slate-200'
      } ${onClick ? 'cursor-pointer hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </Tag>
  );
};

export default StatCard;
