import { useEffect, useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { treasurerAPI } from '../../../services/api';

const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const statusLabels = {
  ready: 'Ready', resume: 'Ready to finish', duplicate: 'Already recorded — will skip',
  error: 'Needs correction', imported: 'Recorded', skipped: 'Already recorded — skipped', failed: 'Needs retry',
};

export default function BulkPaymentUpload({ onClose, onImported }) {
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const downloadTemplate = () => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const contents = `member_id,amount,payment_date,reference_number,payment_method,notes\r\nMEMBER-ID,100.00,${date},RECEIPT-001,cash,Daily contribution\r\n`;
    const url = URL.createObjectURL(new Blob(['\uFEFF', contents], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'daily-payments-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const chooseFile = async event => {
    const file = event.target.files?.[0];
    setCsv(''); setFilename(''); setResult(null); setError(''); setCompleted(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) {
      setError('Choose a CSV file of 1 MB or less.');
      return;
    }
    setBusy(true);
    try { setCsv(await file.text()); setFilename(file.name); }
    catch { setError('Unable to read this file. Please choose it again.'); }
    finally { setBusy(false); }
  };

  const submit = async action => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const response = await treasurerAPI.bulkUploadPayments(csv, action);
      setResult(response);
      setCompleted(action === 'import');
      if (action === 'import') {
        // Keep the recorded result even if a subsequent screen refresh fails.
        try { await onImported(); }
        catch { setError('Import results are shown below. Refresh the page to load updated balances.'); }
      }
    } catch (failure) {
      setError(failure.response?.data?.message || 'Unable to reach the server. Preview the same file again before retrying; completed payments will be skipped.');
      setResult(failure.response?.data?.rows ? failure.response.data : null);
      setCompleted(false);
    } finally { setBusy(false); inFlight.current = false; }
  };

  const summary = result?.summary;
  const canImport = summary && !summary.invalid && summary.ready > 0 && !completed;

  return (
    <dialog ref={dialog} aria-labelledby="bulk-payments-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }} className="m-auto w-[calc(100%_-_2rem)] max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/50">
      <div className="flex items-center justify-between border-b border-slate-200 p-5">
        <h2 id="bulk-payments-title" className="text-xl font-bold text-slate-900">Bulk Upload Payments</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close payment upload" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        <p className="text-sm text-slate-600">Upload the day's cash contributions. Each payment is recorded in the contribution history and credited to the matching member's ledger. Maximum 500 payments per file.</p>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950 space-y-2">
          <p><strong>Required columns:</strong> member_id, amount, payment_date (YYYY-MM-DD), reference_number.</p>
          <p><strong>Optional:</strong> payment_method (cash), notes. Use positive amounts with up to two decimal places, without currency signs or thousands separators.</p>
          <p>Use a receipt or transaction reference for each payment. Reusing a reference for the same member skips an already recorded payment; conflicting amounts or dates must be corrected. Separate payments by the same member need different references.</p>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 font-semibold underline"><Download className="h-4 w-4" />Download CSV Template</button>
          <p className="text-xs">Replace the sample row with actual member IDs and payment details. Keep leading zeros in member IDs when editing in a spreadsheet.</p>
        </div>
        <div>
          <label htmlFor="bulk-payments-file" className="mb-2 block text-sm font-semibold text-slate-700">Daily payments CSV</label>
          <input id="bulk-payments-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold disabled:opacity-50" />
          {filename && <p className="mt-2 text-xs text-slate-500">{filename}</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {summary && <div role="status" className="rounded-xl border border-slate-200 p-4 text-sm">
          {completed ? <p><strong>{summary.imported} recorded</strong> · {summary.duplicates} skipped · {summary.failed} need retry</p>
            : <p><strong>{summary.ready} ready</strong> · {summary.duplicates} already recorded · {summary.invalid} need correction</p>}
          <p className="mt-1 font-semibold">{completed ? 'Amount recorded' : 'Amount to record'}: {money(summary.amount)}</p>
          {!!summary.invalid && <p className="mt-2 text-rose-700">Correct every listed error and upload the corrected file. No payments will be imported while errors remain.</p>}
          {!!summary.failed && <p className="mt-2 text-amber-800">Some payments could not finish and may already have a ledger credit. Preview and import the same file again to finish them safely.</p>}
        </div>}
        {!!result?.rows?.length && <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr>
              {['Row', 'Member', 'Date', 'Reference', 'Amount', 'Result'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{result.rows.map(row => <tr key={row.row}>
              <td className="px-3 py-3">{row.row}</td>
              <td className="px-3 py-3"><p className="font-medium">{row.memberName || row.entry.memberId}</p><p className="text-xs text-slate-500">{row.entry.memberId}</p></td>
              <td className="px-3 py-3 whitespace-nowrap">{row.entry.paymentDate}</td>
              <td className="px-3 py-3 break-all">{row.entry.referenceNumber}</td>
              <td className="px-3 py-3 whitespace-nowrap tabular-nums">{money(row.entry.amount)}</td>
              <td className={`px-3 py-3 ${row.errors.length ? 'text-rose-700' : 'text-slate-700'}`}><p className="font-medium">{statusLabels[row.status]}</p>{row.errors.map(message => <p key={message} className="text-xs mt-1">{message}</p>)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40">{completed ? 'Done' : 'Cancel'}</button>
          <button type="button" disabled={!csv || busy} onClick={() => submit('preview')} className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-40">{result ? 'Preview Again' : 'Preview Payments'}</button>
          {canImport && <button type="button" disabled={busy} onClick={() => submit('import')} className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40"><Upload className="h-4 w-4" />Import {summary.ready} Payments</button>}
        </div>
        {busy && <p role="status" className="text-center text-sm text-slate-600">Processing payments… Please keep this window open.</p>}
      </div>
    </dialog>
  );
}
