const fs=require('fs');
const p='client/src/components/mortuary/treasurer/MemberLedger.jsx';
let s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
s=s.replace("import BulkLedgerUpload from './BulkLedgerUpload';", "import BulkLedgerUpload from './BulkLedgerUpload';\nimport DailyLedgerSummary from './DailyLedgerSummary';");
s=s.replace('  const [showBulkModal, setShowBulkModal] = useState(false);', "  const [showBulkModal, setShowBulkModal] = useState(false);\n  const [ledgerView, setLedgerView] = useState('register');\n  const [summaryVersion, setSummaryVersion] = useState(0);");
s=s.replace('      <section className="ml-filters" aria-labelledby="ml-member-filter-title">', `      <div role="group" aria-label="Member ledger views" className="mb-5 flex gap-3">
        <ActionButton variant={ledgerView === 'register' ? 'default' : 'outline'} aria-pressed={ledgerView === 'register'} onClick={() => setLedgerView('register')}>Member Register</ActionButton>
        <ActionButton variant={ledgerView === 'daily' ? 'default' : 'outline'} aria-pressed={ledgerView === 'daily'} onClick={() => setLedgerView('daily')}>Daily Summary</ActionButton>
      </div>
      {ledgerView === 'daily' ? <DailyLedgerSummary refreshVersion={summaryVersion} /> : <>
      <section className="ml-filters" aria-labelledby="ml-member-filter-title">`);
s=s.replace('      {/* Bulk Upload Modal */}', '      </>}\n      {/* Bulk Upload Modal */}');
s=s.replace('onImported={refreshData}', 'onImported={async () => { setSummaryVersion(value => value + 1); await refreshData?.(); }}');
fs.writeFileSync(p,s);
