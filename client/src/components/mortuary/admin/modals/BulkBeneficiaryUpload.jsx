import { Table as DataTable } from '../../../ui/table';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../../../ui/button';
import { BulkUploadDialog, UploadFilePicker, UploadTemplateCard } from '../../shared/BulkUploadDialog';
import { beneficiaryAPI } from '../../../../services/api';

const statusLabels = {
  ready: 'Ready', error: 'Needs correction', imported: 'Registered', failed: 'Needs retry',
};

export default function BulkBeneficiaryUpload({ onClose, onImported }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const downloadTemplate = () => {
    const contents = `Passbook No.,beneficiary_name,relationship,contact_number,address,notes\r\n000123,Juana Dela Cruz,Spouse,09171234567,123 Rizal St. Brgy. Example,\r\n`;
    const url = URL.createObjectURL(new Blob(['﻿', contents], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'beneficiaries-template.csv';
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
      const response = await beneficiaryAPI.bulkUploadBeneficiaries(csv, action);
      setResult(response);
      setCompleted(action === 'import');
      if (action === 'import') {
        try { await onImported(); }
        catch { setError('Import results are shown below. Refresh the page to load the updated directory.'); }
      }
    } catch (failure) {
      setError(failure.response?.data?.message || 'Unable to reach the server. Preview the same file again before retrying.');
      setResult(failure.response?.data?.rows ? failure.response.data : null);
      setCompleted(false);
    } finally { setBusy(false); inFlight.current = false; }
  };

  const summary = result?.summary;
  const canImport = summary && !summary.invalid && summary.ready > 0 && !completed;

  return (
    <BulkUploadDialog title="Bulk Register Beneficiaries" description="Register or update beneficiaries for multiple members at once."
      busy={busy} onClose={onClose} footer={<>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose} className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50">{completed ? 'Done' : 'Cancel'}</Button>
        <Button type="button" variant={canImport ? 'outline' : 'default'} disabled={!csv || busy} onClick={() => submit('preview')}
          className={canImport ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-coop-green text-white hover:bg-coop-darkGreen'}>{result ? 'Preview Again' : 'Preview Beneficiaries'}</Button>
        {canImport && <Button type="button" disabled={busy} onClick={() => submit('import')} className="gap-2 bg-coop-green text-white hover:bg-coop-darkGreen"><Upload className="h-4 w-4" aria-hidden="true" />Register {summary.ready} Beneficiaries</Button>}
      </>}>
        <UploadTemplateCard onDownload={downloadTemplate} disabled={busy}>
          <p><strong>Required columns:</strong> Passbook No., beneficiary_name, relationship, contact_number.</p>
          <p><strong>Optional:</strong> address, notes.</p>
          <p>Contact number must be an 11-digit PH mobile number starting with 09 (e.g. 09171234567).</p>
          <p>A member who already has a beneficiary on file will have it superseded — the previous record is kept in that member's History. Use one row per member per upload.</p>
          <p>Replace the sample row with actual passbook numbers and beneficiary details. Keep leading zeros in passbook numbers when editing in a spreadsheet.</p>
        </UploadTemplateCard>
        <UploadFilePicker filename={filename} onChange={chooseFile} disabled={busy} hint="CSV only · Up to 1,000 beneficiaries · Maximum 1 MB" />
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {summary && <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {completed ? <p><strong>{summary.imported} registered</strong> · {summary.failed} need retry</p>
            : <p><strong>{summary.ready} ready</strong> · {summary.invalid} need correction</p>}
          {!!summary.invalid && <p className="mt-2 text-rose-700">Correct every listed error and upload the corrected file. No beneficiaries will be registered while errors remain.</p>}
          {!!summary.failed && <p className="mt-2 text-amber-800">Some rows could not finish. Preview and import the same file again to finish them safely.</p>}
        </div>}
        {!!result?.rows?.length && <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
          <DataTable className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>
              {['Row', 'Member', 'Beneficiary', 'Relationship', 'Contact', 'Result'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{result.rows.map(row => <tr key={row.row}>
              <td className="px-3 py-3">{row.row}</td>
              <td className="px-3 py-3"><p className="font-medium">{row.memberName || row.entry.memberId}</p><p className="text-xs text-slate-500">Passbook No.: {row.entry.memberId}</p></td>
              <td className="px-3 py-3">{row.entry.beneficiaryName}</td>
              <td className="px-3 py-3">{row.entry.relationship}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.entry.contactNumber}</td>
              <td className={`px-3 py-3 ${row.errors.length ? 'text-rose-700' : 'text-slate-700'}`}><p className="font-medium">{statusLabels[row.status]}</p>{row.errors.map(message => <p key={message} className="text-xs mt-1">{message}</p>)}</td>
            </tr>)}</tbody>
          </DataTable>
        </div>}
    </BulkUploadDialog>
  );
}
