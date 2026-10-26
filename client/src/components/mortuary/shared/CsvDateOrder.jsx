import { useId } from 'react';

export default function CsvDateOrder({ value, onChange, disabled }) {
  const id = useId();
  return <div className="rounded-lg border border-slate-200 p-4">
    <label htmlFor={id} className="block text-sm font-semibold">Date order in your CSV</label>
    <select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base">
      <option value="auto">Automatic � ask when ambiguous</option>
      <option value="mdy">Month / Day / Year � 03/04/2026 means March 4</option>
      <option value="dmy">Day / Month / Year � 03/04/2026 means April 3</option>
    </select>
    <p className="mt-2 text-sm text-slate-600">Accepts YYYY-MM-DD, March 4, 2026, and 4 Mar 2026. Numeric dates also accept /, - or . separators. Review dates in the preview as YYYY-MM-DD before importing.</p>
  </div>;
}
