import { Button as ActionButton } from '../../ui/button';
import { PageHeader, Panel, PanelHeader } from '../../ui/workspace';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, History } from 'lucide-react';
import { beneficiaryAPI } from '../../../services/api';
import '../treasurer/MemberBalances.css';
import './Beneficiaries.css';

export default function BeneficiaryHistory({ memberId, memberName, onBack, backLabel = 'Back to beneficiaries', parentSection = 'Beneficiaries', registrationBeneficiary, className = '' }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await beneficiaryAPI.getHistory(memberId);
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load beneficiary history.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={`member-balances admin-beneficiaries ${className}`}>
      <PageHeader className="mb-header">
        <div>
          <p className="mb-eyebrow"><span>Mortuary management</span><span aria-hidden="true">/</span><span>{parentSection}</span><span aria-hidden="true">/</span><strong>Beneficiary history</strong></p>
          <h1>Beneficiary history</h1>
          <p className="mb-description">Review current and previous beneficiary records for {memberName}. Passbook No. {memberId}.</p>
        </div>
        <ActionButton variant="outline" onClick={onBack} className="mb-button"><ArrowLeft size={15} aria-hidden="true" />{backLabel}</ActionButton>
      </PageHeader>
      <Panel as="section" className="mb-panel" aria-labelledby="beneficiary-history-title" aria-busy={loading}>
        <PanelHeader as="div" className="mb-register-heading"><div><h2 id="beneficiary-history-title">Record history</h2><p>{memberName}</p></div></PanelHeader>
        <div className="mb-scope"><span>{loading ? 'Loading records…' : error ? 'History unavailable' : `${history.length} beneficiary records`}</span><span>Current and previous designations</span></div>
        {loading ? (
          <div className="mb-empty" role="status"><Loader2 size={22} className="animate-spin" aria-hidden="true" /><p>Loading beneficiary history…</p></div>
        ) : error ? (
          <div className="mb-empty"><p role="alert">{error}</p><ActionButton variant="outline" className="mb-button" onClick={load}>Try again</ActionButton></div>
        ) : history.length > 0 ? (
          <ol className="beneficiary-history-list">
            {history.map(record => (
              <li key={record.beneficiaryId}>
                <span className={`beneficiary-history-dot${record.isActive ? ' is-current' : ''}`} aria-hidden="true" />
                <div className="beneficiary-history-name"><strong>{record.beneficiaryName}</strong>{record.isActive && <span className="mb-status mb-status-active">Current</span>}</div>
                <p>{record.relationship || '—'} · {record.contactNumber || '—'}</p>
                {record.address && <p>{record.address}</p>}
                <p>Effective {new Date(record.effectiveFrom).toLocaleDateString()}
                  {record.effectiveTo ? ` – ${new Date(record.effectiveTo).toLocaleDateString()}` : ' – present'}
                  {record.updatedBy ? ` · by ${record.updatedBy}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : registrationBeneficiary?.name ? (
          <div className="mb-empty" role="status">
            <strong>{registrationBeneficiary.name}</strong>
            <p>{registrationBeneficiary.relationship || 'Relationship not recorded'}</p>
            <p>Recorded at member registration. No formal beneficiary history is available yet.</p>
          </div>
        ) : (
          <div className="mb-empty" role="status"><History size={28} aria-hidden="true" /><strong>No beneficiary records for this member</strong><p>Registered beneficiary records and subsequent changes will appear here.</p></div>
        )}
      </Panel>
    </div>
  );
}
