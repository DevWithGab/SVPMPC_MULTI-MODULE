import React from 'react';

/* Puti ang card, kaya yung tone ay laging napupunta sa icon chip lang -
hindi niya kailangang magdala ng text. Dahil dito, puwede silang mag-stay
vivid: gradient na dark enough para sa white body text ay nagiging muddy,
pero gradient sa likod ng white glyph ay hindi. Yung light stop ng every
pair ay clears 3:1 against white (WCAG non-text contrast), at pumapasa
ang set sa adjacent-pair CVD check (worst deutan ΔE 9.4). */
const TONES = {
  green:  { from: '#16A34A', to: '#0D9488', rgb: '22, 163, 74' },
  blue:   { from: '#3B82F6', to: '#6366F1', rgb: '59, 130, 246' },
  amber:  { from: '#D97706', to: '#EA580C', rgb: '217, 119, 6' },
  rose:   { from: '#E11D48', to: '#BE123C', rgb: '225, 29, 72' },
  slate:  { from: '#64748B', to: '#475569', rgb: '100, 116, 139' },
  violet: { from: '#8B5CF6', to: '#7C3AED', rgb: '139, 92, 246' },
};

/* Yung call sites sa buong module ay nag-spell ng same intent sa iba't
ibang paraan (at nauna nang nahuhulog ang `yellow`/`red` sa default, kaya
mali yung tone na lumalabas). Sinasadyang pinag-fold ang `emerald` sa
`green`: as separate tones, hindi makilala ang dalawa kung katabi sila. */
const ALIASES = {
  emerald: 'green',
  yellow: 'amber',
  red: 'rose',
  purple: 'violet',
  indigo: 'violet',
};

const resolveTone = (color) => TONES[ALIASES[color] || color] || TONES.green;

/* Pag na-truncate ang money value, nagtatago ito ng digits, kaya ang type
ang bumababa instead para fit. Yung thresholds ay sinusukat against sa
tightest case - isang 4-up grid, kung saan ang value ay nakukuha ang full
~235px inner width. Inter bold sa 28px ay tumatakbo ng ~14.2px per
character, kaya ang ₱999,999,999.99 (15 chars, 213px) ay fits pa rin sa
full size at every realistic figure ay naka-render sa 28px. Yung Node
values (e.g. "42 members") ay short by construction at nananatili sa
display size. */
const valueSizeClass = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return 'text-[28px]';
  const len = String(value).length;
  if (len <= 15) return 'text-[28px]';
  if (len <= 18) return 'text-[24px]';
  if (len <= 22) return 'text-[20px]';
  return 'text-[17px]';
};

/* Naka-render as a plain card by default. I-pass ang `onClick` para gawin
itong keyboard-accessible quick filter (e.g. "click this stat to filter the
table by it"), at `active` para i-reflect kung currently applied na ba
yung filter. */
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

      {/* Sinadyang proportional figures: ang tabular-nums ay nagpapamukha
          ng malaking standalone number na maluwag sa size na ito. */}
      <p className={`mt-3 font-bold leading-none text-slate-900 ${valueSizeClass(value)}`}>{value}</p>

      {/* slate-500, hindi slate-400 - sa 11px, ang lighter step ay nasa
          2.6:1 lang sa white, under sa 4.5:1 AA floor. */}
      {subtitle && <p className="mt-2 text-[11px] leading-snug text-slate-500">{subtitle}</p>}
    </Tag>
  );
};

export default StatCard;
