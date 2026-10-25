import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import { noticeThresholdSettingAPI } from '../../../../services/api';
import { DEFAULT_NOTICE_THRESHOLDS } from '../../../../utils/balanceNotice';
import { buildCooperativeNoticeMarkup, COOPERATIVE_NOTICE_STYLES, getNoticeMessageTemplate, missingNoticePlaceholders, requiredNoticePlaceholders } from '../../../../utils/cooperativeNotice';

const fields = [['balance', 'Current balance'], ['amountNeeded', 'Required deposit'], ['targetBalance', 'Maintaining balance'], ['name', 'Member name'], ['address', 'Address'], ['passbook', 'Passbook number'], ['date', 'Current date'], ['managerName', 'Manager name'], ['noticeLabel', 'Notice heading']];

export default function NoticeLetterEditorModal({ onClose, level, current, onSaved }) {
  const fieldKey = level === 3 ? 'finalNoticeMessageTemplate' : 'noticeMessageTemplate';
  const title = level === 3 ? 'Final Notice Content' : 'First & Second Notice Content';
  // The letter as saved when the editor opened: none of its placeholders may be deleted.
  const [savedTemplate] = useState(() => getNoticeMessageTemplate(current, level));
  const [content, setContent] = useState(savedTemplate);
  const required = requiredNoticePlaceholders(level, savedTemplate);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const settings = { ...current, [fieldKey]: content };
  const sample = { id: 123, name: 'Juan Dela Cruz', address: 'Dupax del Sur, Nueva Vizcaya', balance: level === 3 ? -200 : 800 };
  const previewDocument = '<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}' + COOPERATIVE_NOTICE_STYLES + '.official-notice{zoom:0.55}</style></head><body>' + buildCooperativeNoticeMarkup(sample, level, current.targetBalance, window.location.origin + '/SVPMPC-LOGO(MAIN).png', settings) + '</body></html>';

  const insertField = token => {
    if (!token) return;
    const start = input.current?.selectionStart ?? content.length;
    const end = input.current?.selectionEnd ?? start;
    const value = '{' + token + '}';
    setContent(content.slice(0, start) + value + content.slice(end));
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + value.length, start + value.length); });
  };
  const save = async () => {
    if (!content.trim()) { setError('The notice message cannot be empty.'); return; }
    const missing = missingNoticePlaceholders(content, level, savedTemplate).map(key => '{' + key + '}');
    if (missing.length) {
      const list = missing.length > 1 ? missing.slice(0, -1).join(', ') + ' and ' + missing.at(-1) : missing[0];
      setError('The ' + list + ' placeholder' + (missing.length > 1 ? 's' : '') + ' must remain in the letter. Add ' + (missing.length > 1 ? 'them' : 'it') + ' back before saving (use "Insert automatic field").');
      return;
    }
    setSubmitting(true); setError('');
    try {
      await noticeThresholdSettingAPI.updateThresholds({
        targetBalance: current.targetBalance, notice1Min: current.notice1Min, notice1Max: current.notice1Max,
        notice2Min: current.notice2Min, notice2Max: current.notice2Max,
        noticeBodyTemplate: current.noticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.noticeBodyTemplate,
        finalNoticeBodyTemplate: current.finalNoticeBodyTemplate || DEFAULT_NOTICE_THRESHOLDS.finalNoticeBodyTemplate,
        [fieldKey]: content.trim(), description: 'Edited ' + title,
      });
      await onSaved?.(); onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save notice content. Please try again.');
    } finally { setSubmitting(false); }
  };
  return (
    <Modal isOpen onClose={submitting ? () => {} : onClose} title={'Edit ' + title} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Edit the message and closing paragraphs below. The cooperative letterhead, member fields, date, and configured manager name are filled automatically. Change the manager name in Notice Content settings.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">Insert automatic field <select disabled={submitting || preview} value="" onChange={event => insertField(event.target.value)} className="border border-slate-300 rounded px-2 py-1 ml-2"><option value="">Choose a field</option>{fields.map(([token, label]) => <option key={token} value={token}>{label}</option>)}</select></label>
          <button type="button" disabled={submitting} onClick={() => setPreview(!preview)} className="td-button">{preview ? 'Back to editing' : 'Preview notice'}</button>
          <button type="button" disabled={submitting} onClick={() => setContent(getNoticeMessageTemplate(null, level))} className="text-xs text-emerald-700 underline">Reset to cooperative wording</button>
        </div>
        {preview ? <iframe title="Notice preview with sample member details" sandbox="" srcDoc={previewDocument} className="w-full h-[460px] border border-slate-300 bg-white" /> : <label className="block text-sm font-medium">Notice message<textarea ref={input} value={content} onChange={event => setContent(event.target.value)} disabled={submitting} maxLength={10000} rows={12} className="mt-2 w-full border border-slate-300 rounded p-3 text-sm leading-7" /><span className="text-xs text-slate-500">Separate paragraphs with a blank line. Fields in braces are filled with the member's actual details. Placeholders can't be deleted — these must stay in the letter: {required.map(key => '{' + key + '}').join(', ')}.</span></label>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={submitting} className="flex-1">Cancel</Button><Button type="button" onClick={save} disabled={submitting} className="flex-1">{submitting && <Loader2 className="w-4 h-4 animate-spin" />}Save Content</Button></div>
      </div>
    </Modal>
  );
}
