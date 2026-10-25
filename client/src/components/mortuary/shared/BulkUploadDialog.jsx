import { DialogHeader, ModalActions } from '../../ui/workspace';
import { useEffect, useId, useRef } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '../../ui/button';

export function BulkUploadDialog({ title, description, busy, onClose, footer, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
      className="ui-dialog m-auto w-[calc(100%_-_2rem)] max-w-3xl max-h-[90dvh] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[90dvh] flex-col">
        <DialogHeader title={title} titleId={titleId} description={description} descriptionId={descriptionId} busy={busy} onClose={onClose} closeLabel="Close upload dialog" />
        <div className="ui-dialog-body space-y-5">{children}</div>
        <div className="ui-dialog-footer shrink-0 border-t border-slate-200 bg-white">
          {busy && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Processing your file. Please keep this window open.</p>}
          <ModalActions>{footer}</ModalActions>
        </div>
      </div>
    </dialog>
  );
}

export function UploadTemplateCard({ onDownload, disabled, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-coop-green" aria-hidden="true" />
          <div><p className="text-sm font-semibold text-slate-900">Start with the CSV template</p><p className="mt-0.5 text-xs text-slate-500">Fill in your entries using the sample format.</p></div>
        </div>
        <Button type="button" variant="outline" onClick={onDownload} disabled={disabled} className="shrink-0 gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden="true" />Download Template</Button>
      </div>
      <details className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <summary className="cursor-pointer rounded font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coop-green">CSV format and guidelines</summary>
        <div className="mt-3 space-y-2 leading-relaxed break-words">{children}</div>
      </details>
    </div>
  );
}

export function UploadFilePicker({ filename, onChange, disabled, hint }) {
  const input = useRef(null);
  const inputId = useId();
  return (
    <div className={`rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${filename ? 'border-coop-green/40 bg-green-50/50' : 'border-slate-200 bg-white hover:border-coop-green/40'}`}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-coop-green">
        {filename ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Upload className="h-6 w-6" aria-hidden="true" />}
      </div>
      <p className="text-sm font-semibold text-slate-900">{filename ? 'CSV file selected' : 'Choose your CSV file'}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {filename && <p role="status" className="mx-auto mt-3 max-w-full break-all text-sm font-medium text-coop-green">{filename}</p>}
      <input ref={input} id={inputId} type="file" accept=".csv,text/csv" disabled={disabled} onChange={onChange} className="hidden" aria-label="Choose CSV file" />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current.click()} className="mt-4 gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" />{filename ? 'Change File' : 'Choose File'}</Button>
    </div>
  );
}
