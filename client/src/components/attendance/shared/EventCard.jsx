import React from "react";

export default function EventCard({
  title = "Event",
  subtitle = "",
  children,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
            {subtitle}
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>
        </div>
      </div>
      {children && <div className="mt-4 text-slate-600">{children}</div>}
    </div>
  );
}
