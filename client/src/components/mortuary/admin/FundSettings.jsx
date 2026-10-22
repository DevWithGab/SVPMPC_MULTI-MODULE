import React, { useState } from 'react';
import { Banknote, Bell, FileText, ShieldCheck } from 'lucide-react';
import DeductionSettings from './DeductionSettings';
import NoticeThresholdSettings from './NoticeThresholdSettings';
import NoticeContentSettings from './NoticeContentSettings';
import BenefitCapSettings from './BenefitCapSettings';
import '../treasurer/Dashboard.css';
import './FundSettings.css';

const sections = [
  { id: 'deduction', label: 'Deduction rate', icon: Banknote, component: DeductionSettings },
  { id: 'benefitCap', label: 'Benefit cap', icon: ShieldCheck, component: BenefitCapSettings },
  { id: 'notices', label: 'Notice thresholds', icon: Bell, component: NoticeThresholdSettings },
  { id: 'noticeContent', label: 'Notice content', icon: FileText, component: NoticeContentSettings },
];

export default function FundSettings({ user }) {
  const [tab, setTab] = useState('deduction');
  const activeSection = sections.find(section => section.id === tab);
  const ActiveSettings = activeSection.component;

  return (
    <div className="treasurer-dashboard fund-settings">
      <header className="td-header">
        <div>
          <p className="td-eyebrow">Mortuary management / Settings</p>
          <h1>Settings</h1>
          <p className="td-description">Manage claim deductions, benefit limits, and member notice thresholds and content.</p>
        </div>
      </header>
      <div className="fs-navigation" role="group" aria-label="Settings sections">
        {sections.map(section => (
          <button key={section.id} id={`fs-section-${section.id}`} aria-pressed={tab === section.id} aria-controls="fs-content" onClick={() => setTab(section.id)}>
            {React.createElement(section.icon, { size: 16, 'aria-hidden': true })}
            {section.label}
          </button>
        ))}
      </div>
      <section id="fs-content" aria-labelledby={`fs-section-${tab}`}>
        <ActiveSettings key={tab} user={user} />
      </section>
    </div>
  );
}
