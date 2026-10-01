import React, { useState } from 'react';
import { Banknote, Bell, FileText } from 'lucide-react';
import DeductionSettings from './DeductionSettings';
import NoticeThresholdSettings from './NoticeThresholdSettings';
import NoticeContentSettings from './NoticeContentSettings';

// All three deal with fund-triggered settings the admin tunes over time
// (the deduction rate, the balance thresholds that trigger notices, and the
// letter text those notices actually print) — grouped under one page with a
// tab switcher instead of separate sidebar entries, since none is used
// often enough to deserve its own top-level section. Thresholds and letter
// content are split into separate tabs (rather than one combined "Notices"
// tab) since editing a document is a materially different, heavier task
// than tweaking a few numbers.
export default function FundSettings({ user }) {
  const [tab, setTab] = useState('deduction'); // 'deduction' | 'notices' | 'noticeContent'

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fund Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          The claim deduction rate and the balance thresholds that trigger member notices.
        </p>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setTab('deduction')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            tab === 'deduction' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Banknote className="w-4 h-4" /> Deduction Rate
        </button>
        <button
          onClick={() => setTab('notices')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            tab === 'notices' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Bell className="w-4 h-4" /> Notice Thresholds
        </button>
        <button
          onClick={() => setTab('noticeContent')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            tab === 'noticeContent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" /> Notice Content
        </button>
      </div>

      {tab === 'deduction' && <DeductionSettings user={user} />}
      {tab === 'notices' && <NoticeThresholdSettings user={user} />}
      {tab === 'noticeContent' && <NoticeContentSettings user={user} />}
    </div>
  );
}
