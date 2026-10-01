import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eye, Pencil, Loader2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import Button from '../../../shared/ui/Button';
import { noticeThresholdSettingAPI } from '../../../../services/api';
import { legacyPlainTextToHtml, substitutePlaceholders } from '../../../../utils/balanceNotice';

// Sample data shown when the admin toggles "Preview" — lets them see the
// document the way a member would receive it without leaving the editor.
const SAMPLE_VALUES_BY_LEVEL = {
  1: {
    noticeLabel: 'NOTICE 1', name: 'Juan Dela Cruz', address: '123 Sample Street, Barangay Uno',
    passbook: '#000123', balanceText: '₱800.00', amountNeeded: '₱200.00', targetBalanceText: '₱1,000.00',
    managerName: 'Treasurer Name',
  },
  3: {
    noticeLabel: 'FINAL NOTICE', name: 'Juan Dela Cruz', address: '123 Sample Street, Barangay Uno',
    passbook: '#000123', balanceText: '-₱200.00', amountNeeded: '₱1,200.00', targetBalanceText: '₱1,000.00',
    managerName: 'Treasurer Name',
  },
};

const FIELD_OPTIONS = [
  { token: 'noticeLabel', label: 'Notice Label' },
  { token: 'name', label: 'Member Name' },
  { token: 'address', label: 'Address' },
  { token: 'passbook', label: 'Passbook No.' },
  { token: 'balance', label: 'Balance' },
  { token: 'amountNeeded', label: 'Amount Needed' },
  { token: 'targetBalance', label: 'Target Balance' },
  { token: 'managerName', label: 'Manager Name' },
];

// Strips <script> tags and inline event-handler attributes before saving.
// This content is admin-authored through a controlled toolbar, but a paste
// from elsewhere could still carry something dangerous — cheap insurance
// before it's stored and later rendered into a real print window.
const sanitizeHtml = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('script').forEach((el) => el.remove());
  container.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name) || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return container.innerHTML;
};

export default function NoticeLetterEditorModal({ isOpen, onClose, level, current, user, onSaved }) {
  const editorRef = useRef(null);
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [previewHtml, setPreviewHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fieldKey = level === 3 ? 'finalNoticeBodyTemplate' : 'noticeBodyTemplate';
  const title = level === 3 ? 'Final Notice Document' : 'Notice 1 & 2 Document';

  // Loaded fresh every time the modal opens — not on every `current`
  // change, so a parent re-render mid-edit can't clobber unsaved work.
  useEffect(() => {
    if (isOpen && editorRef.current) {
      const raw = current?.[fieldKey] || '';
      editorRef.current.innerHTML = legacyPlainTextToHtml(raw);
      document.execCommand('defaultParagraphSeparator', false, 'p');
      setMode('edit');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const exec = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const insertField = (token) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, `{${token}}`);
  };

  const switchToPreview = () => {
    const liveHtml = editorRef.current?.innerHTML || '';
    const samples = SAMPLE_VALUES_BY_LEVEL[level] || SAMPLE_VALUES_BY_LEVEL[1];
    setPreviewHtml(substitutePlaceholders(liveHtml, samples));
    setMode('preview');
  };

  const handleSave = async () => {
    const content = sanitizeHtml(editorRef.current?.innerHTML || '').trim();
    if (!content) {
      setError('The document cannot be empty.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await noticeThresholdSettingAPI.updateThresholds({
        targetBalance: current.targetBalance,
        notice1Min: current.notice1Min,
        notice1Max: current.notice1Max,
        notice2Min: current.notice2Min,
        notice2Max: current.notice2Max,
        noticeBodyTemplate: fieldKey === 'noticeBodyTemplate' ? content : current.noticeBodyTemplate,
        finalNoticeBodyTemplate: fieldKey === 'finalNoticeBodyTemplate' ? content : current.finalNoticeBodyTemplate,
        description: `Edited ${title} via document editor`,
        createdBy: user?.name || user?.username,
      });
      onClose();
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save this document.');
    } finally {
      setSubmitting(false);
    }
  };

  const toolbarButtonClass = 'p-2 text-slate-600 hover:bg-white hover:text-coop-green rounded transition-colors';

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => {} : onClose} title={`Edit ${title}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button type="button" onClick={() => exec('bold')} className={toolbarButtonClass} title="Bold"><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => exec('italic')} className={toolbarButtonClass} title="Italic"><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => exec('underline')} className={toolbarButtonClass} title="Underline"><Underline className="w-4 h-4" /></button>
            <span className="w-px h-5 bg-slate-300 mx-1" />
            <button type="button" onClick={() => exec('justifyLeft')} className={toolbarButtonClass} title="Align left"><AlignLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => exec('justifyCenter')} className={toolbarButtonClass} title="Align center"><AlignCenter className="w-4 h-4" /></button>
            <button type="button" onClick={() => exec('justifyRight')} className={toolbarButtonClass} title="Align right"><AlignRight className="w-4 h-4" /></button>
            <button type="button" onClick={() => exec('justifyFull')} className={toolbarButtonClass} title="Justify"><AlignJustify className="w-4 h-4" /></button>
            <span className="w-px h-5 bg-slate-300 mx-1" />
            <select
              onChange={(e) => { if (e.target.value) { insertField(e.target.value); e.target.value = ''; } }}
              defaultValue=""
              className="text-xs border-0 bg-transparent focus:outline-none text-slate-600"
            >
              <option value="" disabled>Insert field…</option>
              {FIELD_OPTIONS.map((f) => (
                <option key={f.token} value={f.token}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'edit' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={switchToPreview}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === 'preview' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
        </div>

        {/* The "page" — styled like the actual printed letter so editing here closely matches the printed result */}
        <div className="bg-white border border-slate-300 shadow-sm mx-auto max-h-[55vh] overflow-y-auto" style={{ maxWidth: '680px' }}>
          <div className="p-10" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '13pt', color: '#111' }}>
            <div className="flex items-center justify-center gap-4 pb-3 mb-5 border-b-2 border-slate-900">
              <img src="/SVPMPC-LOGO(MAIN).png" alt="" className="w-12 h-12 object-contain shrink-0" />
              <div className="text-center">
                <p className="font-bold" style={{ fontSize: '16pt', margin: 0 }}>St. Vincent Parish Multi-Purpose Cooperative</p>
                <p className="text-slate-600" style={{ fontSize: '10.5pt', margin: '2px 0 0' }}>Mortuary Aid Fund Program</p>
              </div>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="outline-none min-h-[300px]"
              style={{ lineHeight: 1.7, textAlign: 'justify', display: mode === 'edit' ? 'block' : 'none' }}
            />
            {mode === 'preview' && (
              <div
                className="min-h-[300px]"
                style={{ lineHeight: 1.7, textAlign: 'justify' }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Edit this exactly like a document — select text and use the toolbar to format it. Placeholders like{' '}
          <code className="font-mono bg-slate-100 px-1 rounded">{'{name}'}</code> are replaced with each member's
          real details when printed; use "Insert field" to add one, or switch to Preview to see sample data filled
          in.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} className="flex-1" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Document
          </Button>
        </div>
      </div>
    </Modal>
  );
}
