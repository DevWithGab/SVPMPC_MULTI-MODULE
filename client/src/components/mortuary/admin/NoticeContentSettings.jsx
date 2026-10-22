import React from 'react';

export default function NoticeContentSettings() {
  return (
    <div className="fs-section">
      <p className="fs-section-description">
        All notices use the official cooperative forms. Member details, date, balance,
        required deposit, and manager name are filled automatically when printing or downloading.
      </p>
      <div className="fs-notice-grid">
        <div className="fs-panel fs-notice-card">
          <div className="fs-notice-heading">
            <p className="text-sm font-bold text-slate-900">Notice 1 &amp; 2 Document</p>
            <span className="text-xs text-slate-500">Official cooperative template</span>
          </div>
          <p className="fs-notice-preview line-clamp-6">
            MORTUARY AID FUND PROGRAM - FIRST NOTICE / SECOND NOTICE. Requests an additional
            deposit to restore the maintaining balance. Signed by MONINA C. GUZMAN, Manager.
          </p>
        </div>
        <div className="fs-panel fs-notice-card">
          <div className="fs-notice-heading">
            <p className="text-sm font-bold text-slate-900">Final Notice Document</p>
            <span className="text-xs text-slate-500">Official cooperative template</span>
          </div>
          <p className="fs-notice-preview line-clamp-6">
            MORTUARY AID FUND PROGRAM - LAST NOTICE. Requests replenishment within (30) days
            to maintain membership and warns that failure to do so will automatically drop
            the member from the program. Signed by MONINA C. GUZMAN, Manager.
          </p>
        </div>
      </div>
    </div>
  );
}
