import React from 'react';

const COLOR_STYLES = {
  emerald: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-coop-green' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600' },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'emerald', accent = false }) {
  const c = COLOR_STYLES[color] || COLOR_STYLES.emerald;

  if (accent) {
    return (
      <div className="relative w-full bg-gradient-to-br from-coop-green to-coop-darkGreen rounded-xl p-5 flex items-start gap-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-sm">
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl" />
        <div className="relative w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="relative min-w-0">
          <p className="text-xs font-medium text-green-100/90">{title}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
          {subtitle && <p className="text-xs text-green-100/70 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0 transition-transform duration-200`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
