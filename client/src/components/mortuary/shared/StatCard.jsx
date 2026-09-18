import React from 'react';

// The card is white, so the tone only ever fills the icon chip — it never has to
// carry text. That's what lets these stay vivid: a gradient dark enough to hold
// white body text goes muddy, a gradient behind a white glyph does not.
// Light stop of every pair clears 3:1 against white (WCAG non-text contrast),
// and the set passes the adjacent-pair CVD check (worst deutan ΔE 9.4).
const TONES = {
  green:  { from: '#16A34A', to: '#0D9488', rgb: '22, 163, 74' },
  blue:   { from: '#3B82F6', to: '#6366F1', rgb: '59, 130, 246' },
  amber:  { from: '#D97706', to: '#EA580C', rgb: '217, 119, 6' },
  rose:   { from: '#E11D48', to: '#BE123C', rgb: '225, 29, 72' },
  slate:  { from: '#64748B', to: '#475569', rgb: '100, 116, 139' },
  violet: { from: '#8B5CF6', to: '#7C3AED', rgb: '139, 92, 246' },
};

// Call sites across the module spell the same intent a few different ways
// (and `yellow`/`red` previously fell through to the default, rendering the
// wrong tone). `emerald` folds into `green` on purpose: as separate tones the
// two were indistinguishable side by side.
const ALIASES = {
  emerald: 'green',
  yellow: 'amber',
  red: 'rose',
  purple: 'violet',
  indigo: 'violet',
};

const resolveTone = (color) => TONES[ALIASES[color] || color] || TONES.green;

// Truncating a money value hides digits, so the type steps down to fit instead.
// Thresholds are measured against the tightest case — a 4-up grid, where the
// value gets the full ~235px inner width. Inter bold at 28px runs ~14.2px per
// character, so ₱999,999,999.99 (15 chars, 213px) still fits at full size and
// every realistic figure renders at 28px. Node values (e.g. "42 members") are
// short by construction and keep the display size.
const valueSizeClass = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return 'text-[28px]';
  const len = String(value).length;
  if (len <= 15) return 'text-[28px]';
  if (len <= 18) return 'text-[24px]';
  if (len <= 22) return 'text-[20px]';
  return 'text-[17px]';
};

// Renders as a plain card by default. Pass `onClick` to turn it into a
// keyboard-accessible quick filter (e.g. "click this stat to filter the table by it"),
// and `active` to reflect whether that filter is currently applied.
const StatCard = ({ title, value, subtitle, icon: Icon, color = 'emerald', onClick, active = false }) => {
  const t = resolveTone(color);
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      style={{ '--accent': t.to, '--accent-tint': `rgba(${t.rgb}, 0.06)` }}
      className={`relative w-full rounded-2xl border bg-white p-5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-all duration-200 ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-tint)] ring-1 ring-[var(--accent)]'
          : 'border-slate-200'
      } ${
        onClick
          ? 'cursor-pointer hover:border-slate-300 hover:shadow-[0_4px_12px_-2px_rgba(16,24,40,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </p>
        {Icon && (
          <span
            style={{
              backgroundImage: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
              boxShadow: `0 4px 10px -4px rgba(${t.rgb}, 0.55)`,
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Proportional figures on purpose: tabular-nums makes a large standalone
          number look loose at this size. */}
      <p className={`mt-3 font-bold leading-none text-slate-900 ${valueSizeClass(value)}`}>{value}</p>

      {/* slate-500, not slate-400 — at 11px the lighter step sits at 2.6:1 on
          white, under the 4.5:1 AA floor. */}
      {subtitle && <p className="mt-2 text-[11px] leading-snug text-slate-500">{subtitle}</p>}
    </Tag>
  );
};

export default StatCard;
