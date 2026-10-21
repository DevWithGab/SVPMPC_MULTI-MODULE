import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import { BulkUploadDialog, UploadFilePicker, UploadTemplateCard } from '../shared/BulkUploadDialog';
import { treasurerAPI } from '../../../services/api';

const labels = { ready: 'Ready', error: 'Needs correction', imported: 'Recorded', failed: 'Needs retry' };

export default function BulkLedgerUpload({ onClose, onImported, onDownloadTemplate }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const chooseFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
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
      const response = await treasurerAPI.bulkUploadLedger(csv, action);
      setResult(response);
      setCompleted(action === 'import');
      if (action === 'import') {
        try { await onImported?.(); }
        catch { setError('Import results are shown below. Refresh the page to load updated balances.'); }
      }
    } catch (failure) {
      setResult(failure.response?.data?.rows ? failure.response.data : null);
      setError(failure.response?.data?.message || 'Unable to process this file. Preview again before retrying.');
    } finally { setBusy(false); inFlight.current = false; }
  };

  const summary = result?.summary;
  const canImport = summary && !summary.invalid && summary.ready > 0 && !completed;

  return (
    <BulkUploadDialog title="Bulk Upload Ledger" description="Preview and validate every entry before importing into members' ledgers."
      busy={busy} onClose={onClose} footer={<>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{completed ? 'Done' : 'Cancel'}</Button>
        <Button type="button" variant="outline" disabled={!csv || busy} onClick={() => submit('preview')}>{result ? 'Preview Again' : 'Preview Entries'}</Button>
        {canImport && <Button type="button" disabled={busy} onClick={() => submit('import')} className="gap-2 bg-coop-green text-white hover:bg-coop-darkGreen"><Upload className="h-4 w-4" aria-hidden="true" />Import {summary.ready} Entries</Button>}
      </>}>
      <UploadTemplateCard onDownload={onDownloadTemplate} disabled={busy}>
        <p>Required columns: Passbook No., transactionDate (YYYY-MM-DD), credit, debit. Keep leading zeros in passbook numbers.</p>
        <p>Enter a positive amount in either credit or debit and 0 in the other, with up to two decimal places, without currency signs or thousands separators.</p>
        <p>Optional columns: description, transactionType, referenceId, paymentMethod (cash). Transaction types: contribution, payout, adjustment, penalty, automatic_deduction, claim_payout.</p>
        <p>Every row is checked. Unknown passbook numbers, invalid values, and duplicate entries must be corrected before importing.</p>
      </UploadTemplateCard>
      <UploadFilePicker filename={filename} onChange={chooseFile} disabled={busy} hint="CSV only · Up to 1,000 entries · Maximum 1 MB" />
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {summary && !completed && <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p><strong>{summary.ready} ready</strong> · {summary.invalid} need correction · {summary.total} total</p>
        {!!summary.invalid && <p className="mt-2 text-rose-700">Correct every listed error and upload the corrected file. No entries will be imported while errors remain.</p>}
      </div>}
      {completed && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{result.results.success.length} recorded · {result.results.failed.length} failed. {result.results.failed.length ? 'Review the errors below. Preview again before retrying; remove entries already recorded.' : 'All ledger entries were imported successfully.'}</p>}
      {!!result?.rows?.length && <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>
            {['Row', 'Member', 'Date', 'Reference', 'Credit', 'Debit', 'Type', 'Result'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{result.rows.map(row => <tr key={row.row}>
            <td className="px-3 py-3">{row.row}</td>
            <td className="px-3 py-3"><p className="font-medium">{row.memberName || row.entry.memberId}</p><p className="text-xs text-slate-500">Passbook No.: {row.entry.memberId}</p></td>
            <td className="px-3 py-3 whitespace-nowrap">{row.entry.transactionDate}</td>
            <td className="px-3 py-3 break-all">{row.entry.referenceId}</td>
            <td className="px-3 py-3 tabular-nums">{row.entry.credit}</td>
            <td className="px-3 py-3 tabular-nums">{row.entry.debit}</td>
            <td className="px-3 py-3">{row.entry.transactionType}</td>
            <td className={`px-3 py-3 ${row.errors.length ? 'text-rose-700' : 'text-slate-700'}`}><p className="font-medium">{labels[row.status]}</p>{row.errors.map(message => <p key={message} className="mt-1 text-xs">{message}</p>)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </BulkUploadDialog>
  );
}
