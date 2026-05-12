import React from "react";

export default function QRGenerator({ label = "Generate QR", onGenerate }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">
            QR Generator
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{label}</h3>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-2xl bg-coop-green px-4 py-2 text-sm font-black text-white shadow-lg shadow-coop-green/20 transition hover:bg-coop-darkGreen"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
