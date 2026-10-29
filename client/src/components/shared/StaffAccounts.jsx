import { Select } from '../ui/input';
import { Table as DataTable } from '../ui/table';
import { useEffect, useRef, useState } from 'react';
import { staffAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Pagination, PaginationInfo } from '../ui/pagination';
import { usePagination } from '../../hooks/usePagination';
import { ROLE_MODULES as roleModules } from '../../utils/constants';
const empty = { fullName: '', username: '', role: 'secretary', modules: ['attendance'], status: 'active' };
const label = value => ({ claims_officer: 'Claims Officer', finance_officer: 'Finance Officer', treasurer: 'Finance Officer (legacy)' })[value] || value.replaceAll('_', ' ');

export default function StaffAccounts() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState('attendance');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const requestVersion = useRef(0);
  const refresh = async () => {
    const version = ++requestVersion.current;
    setLoadingList(true); setListError('');
    try {
      const result = await staffAPI.list();
      if (version === requestVersion.current) setUsers(result.users);
    } catch (e) {
      if (version === requestVersion.current) setListError(e.response?.data?.message || 'Unable to load staff accounts. Try Refresh list.');
    } finally {
      if (version === requestVersion.current) setLoadingList(false);
    }
  };
  useEffect(() => { const requests = requestVersion; refresh(); return () => { requests.current++; }; }, []);
  const run = async action => {
    requestVersion.current++; // A pending older read must not replace a successful write.
    setLoadingList(false);
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e.response?.data?.message || 'Unable to complete this action.'); }
    finally { setBusy(false); }
  };
  const { page, limit, setPage } = usePagination(1, 100);
  useEffect(() => { setPage(1); }, [search, system, setPage]);
  const filteredUsers = users.filter(user => user.modules.includes(system) && `${user.fullName || ''} ${user.username}`.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredUsers.length / limit) || 1;
  const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);

  const save = e => {
    e.preventDefault();
    run(async () => {
      const result = form.userId ? await staffAPI.update(form.userId, form) : await staffAPI.create(form);
      setUsers(previous => [result.user, ...previous.filter(user => user.userId !== result.user.userId)]);
      setSearch('');
      setSystem(result.user.modules[0]);
      setCredentials(result.credentials || null); setForm(null);
    });
  };
  return <section className="sam-staff-accounts bg-white border border-slate-200 rounded-xl p-6 mb-8" aria-label="Staff accounts">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <div><h2 className="text-xl font-bold">Staff Accounts</h2><p className="text-sm text-slate-500">Create accounts, assign access, and manage staff sign-in.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={busy || loadingList} onClick={refresh}>Refresh list</Button><Button disabled={busy || loadingList || Boolean(credentials)} onClick={() => { setForm({ ...empty, role: system === 'mortuary' ? 'claims_officer' : 'secretary', modules: [system] }); setError(''); }}>Create staff account</Button></div>
    </div>
    <div role="group" aria-label="Staff system" className="flex gap-3 mb-4">{['attendance', 'mortuary'].map(module => <Button key={module} variant={system === module ? 'default' : 'outline'} aria-pressed={system === module} onClick={() => setSystem(module)}>{module === 'attendance' ? 'Attendance' : 'Mortuary'}</Button>)}</div>
    {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
    {credentials && <div className="border border-emerald-300 bg-emerald-50 p-4 rounded-lg mb-5" role="status">
      <h3 className="font-bold">Save these credentials now</h3>
      <p className="text-sm mb-3">The temporary password is shown once. Share it privately with the staff member. They must change it on first login.</p>
      <p>Username: <code className="select-all break-all">{credentials.username}</code></p>
      <p>Temporary password: <code className="select-all break-all">{credentials.password}</code></p>
      <Button className="mt-3" onClick={() => setCredentials(null)}>I have saved the credentials</Button>
    </div>}
    {form && <form onSubmit={save} className="border rounded-lg p-4 mb-5 space-y-4">
      <h3 className="font-bold">{form.userId ? `Edit staff account` : 'New staff account'}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm">Name<Input required minLength={2} value={form.fullName || ''} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
        <label className="text-sm">Login username<Input required minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9._\-]{2,31}" autoComplete="off" value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} /><span className="text-xs text-slate-500">3–32 characters, e.g. maria.santos. Staff use this username to sign in.</span></label>
      </div>
      <label className="block text-sm">System<Select className="block border rounded p-2 mt-1" value={form.modules[0]} onChange={e => setForm({ ...form, modules: [e.target.value], role: e.target.value === 'mortuary' ? 'claims_officer' : 'secretary' })}><option value="attendance">Attendance</option><option value="mortuary">Mortuary</option></Select></label>
      <label className="block text-sm">Role<Select className="block border rounded p-2 mt-1" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.keys(roleModules).filter(role => roleModules[role].includes(form.modules[0])).map(role => <option key={role} value={role}>{label(role)}</option>)}</Select></label>
      {form.modules[0] === 'mortuary' && <p className="text-sm text-slate-500">{form.role === 'claims_officer' ? 'Claims Officer: Dashboard, Claims, and Beneficiaries.' : 'Finance Officer: the finance dashboard, member ledger, balances, financial claims processing, reports, and settings.'} Both roles use the same Mortuary sign-in page.</p>}
      {form.userId && <label className="block text-sm">Status<Select className="block border rounded p-2 mt-1" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{['active', 'inactive', 'suspended'].map(status => <option key={status}>{status}</option>)}</Select></label>}
      {form.userId && <p className="text-sm text-slate-500">Saving access changes signs this staff member out of existing sessions.</p>}
      {form.userId && users.find(user => user.userId === form.userId)?.modules.length > 1 && <p className="text-sm text-amber-800">This legacy account currently serves both systems. Saving assigns only the system selected above. Create a separate account for the other system if that access is still needed.</p>}
      <div className="flex gap-3"><Button type="submit" disabled={busy || !form.modules.length}>{busy ? 'Saving…' : form.userId ? 'Save changes' : 'Generate account'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button></div>
    </form>}
    <Input aria-label="Search staff" placeholder="Search staff by name or username" value={search} onChange={e => setSearch(e.target.value)} />
    {loadingList && <p role="status" className="py-3">Loading staff accounts...</p>}
    {listError && <p role="alert" className="py-3 text-red-700">{listError}</p>}
    <div className="overflow-x-auto mt-4"><DataTable className="w-full text-sm text-left"><thead><tr>{['Staff', 'Role', 'Modules', 'Status', 'Actions'].map(title => <th className="p-3 border-b" key={title}>{title}</th>)}</tr></thead>
      <tbody>{paginatedUsers.map(user => <tr key={user.userId}>
        <td className="p-3 border-b"><p className="font-semibold">{user.fullName || user.username}</p><p>{user.email}</p><p className="text-xs text-slate-500">{user.username}</p></td>
        <td className="p-3 border-b capitalize">{system === 'mortuary' && user.role === 'admin' ? 'Claims Officer (legacy)' : label(user.role)}</td><td className="p-3 border-b capitalize">{user.modules.join(', ')}</td><td className="p-3 border-b">{user.status}{user.isTemporaryPassword && <p className="text-xs text-amber-700">Password change required</p>}</td>
        <td className="p-3 border-b"><div className="flex gap-2"><Button variant="outline" tooltip="Update this staff member's details, role, and system access." disabled={busy || Boolean(credentials)} onClick={() => setForm({ ...user, modules: [system], role: system === 'mortuary' ? ({ admin: 'claims_officer', treasurer: 'finance_officer' })[user.role] || user.role : user.role })}>Edit account</Button><Button variant="outline" tooltip="Generate a temporary password and sign out this staff member." disabled={busy || Boolean(credentials)} onClick={() => {
          if (window.confirm(`Reset ${user.username}'s password and sign them out?`)) run(async () => { const result = await staffAPI.resetPassword(user.userId); setCredentials(result.credentials); setUsers(previous => previous.map(row => row.userId === user.userId ? { ...row, isTemporaryPassword: true } : row)); });
        }}>Reset password</Button><Button variant="outline" tooltip="Permanently remove staff access. Historical records and audit logs are retained." className="text-red-700" disabled={busy || Boolean(credentials)} onClick={() => {
          if (window.confirm(`Permanently delete ${user.fullName || user.username} (${user.username})? They will lose access immediately. Historical records and audit logs will be retained. This cannot be undone.`)) run(async () => {
            await staffAPI.remove(user.userId);
            setUsers(previous => previous.filter(row => row.userId !== user.userId));
            if (form?.userId === user.userId) setForm(null);
          });
        }}>Delete</Button></div></td>
      </tr>)}</tbody></DataTable>{!loadingList && !listError && !users.length && <p className="py-4 text-slate-500">No staff accounts yet.</p>}{users.length > 0 && !filteredUsers.length && <p className="py-4 text-slate-500">No staff match this search. Clear the search to see all accounts.</p>}</div>
    {filteredUsers.length > 0 && <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
      <PaginationInfo currentPage={page} limit={limit} total={filteredUsers.length} />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} hasNextPage={page < totalPages} hasPrevPage={page > 1} />
    </div>}
  </section>;
}
