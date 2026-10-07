import { useEffect, useRef, useState } from 'react';
import { staffAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const roleModules = { admin: ['attendance', 'mortuary'], secretary: ['attendance'], scanner_operator: ['attendance'], treasurer: ['mortuary'] };
const empty = { fullName: '', username: '', email: '', phoneNumber: '', role: 'secretary', modules: ['attendance'], status: 'active' };
const label = value => value.replaceAll('_', ' ');

export default function StaffAccounts() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
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
  const save = e => {
    e.preventDefault();
    run(async () => {
      const result = form.userId ? await staffAPI.update(form.userId, form) : await staffAPI.create(form);
      setUsers(previous => [result.user, ...previous.filter(user => user.userId !== result.user.userId)]);
      setSearch('');
      setCredentials(result.credentials || null); setForm(null);
    });
  };
  return <section className="bg-white border border-slate-200 rounded-xl p-6 mb-8" aria-label="Staff accounts">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <div><h2 className="text-xl font-bold">Staff Accounts</h2><p className="text-sm text-slate-500">Create accounts, assign access, and manage staff sign-in.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={busy || loadingList} onClick={refresh}>Refresh list</Button><Button disabled={busy || loadingList || Boolean(credentials)} onClick={() => { setForm({ ...empty }); setError(''); }}>Create staff account</Button></div>
    </div>
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
      {!form.userId && <div className="grid md:grid-cols-3 gap-4">
        {[['email', 'Email', 'email'], ['phoneNumber', 'Mobile number', 'tel']].map(([key, title, type]) => <label key={key} className="text-sm">{title}<Input required type={type} value={form[key]} pattern={key === 'phoneNumber' ? '09[0-9]{9}' : undefined} placeholder={key === 'phoneNumber' ? '09123456789' : title} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      </div>}
      <label className="block text-sm">Role<select className="block border rounded p-2 mt-1" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, modules: [...roleModules[e.target.value]] })}>{Object.keys(roleModules).map(role => <option key={role} value={role}>{label(role)}</option>)}</select></label>
      <fieldset><legend className="text-sm mb-2">Module access</legend><div className="flex gap-5">{roleModules[form.role].map(module => <label key={module} className="capitalize"><input type="checkbox" checked={form.modules.includes(module)} onChange={e => setForm({ ...form, modules: e.target.checked ? [...form.modules, module] : form.modules.filter(m => m !== module) })} /> {module}</label>)}</div></fieldset>
      {form.userId && <label className="block text-sm">Status<select className="block border rounded p-2 mt-1" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{['active', 'inactive', 'suspended'].map(status => <option key={status}>{status}</option>)}</select></label>}
      {form.userId && <p className="text-sm text-slate-500">Saving access changes signs this staff member out of existing sessions.</p>}
      <div className="flex gap-3"><Button type="submit" disabled={busy || !form.modules.length}>{busy ? 'Saving…' : form.userId ? 'Save changes' : 'Generate account'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>Cancel</Button></div>
    </form>}
    <Input aria-label="Search staff" placeholder="Search staff by name, username, or email" value={search} onChange={e => setSearch(e.target.value)} />
    {loadingList && <p role="status" className="py-3">Loading staff accounts...</p>}
    {listError && <p role="alert" className="py-3 text-red-700">{listError}</p>}
    <div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><thead><tr>{['Staff', 'Role', 'Modules', 'Status', 'Actions'].map(title => <th className="p-3 border-b" key={title}>{title}</th>)}</tr></thead>
      <tbody>{users.filter(user => `${user.fullName || ''} ${user.username} ${user.email}`.toLowerCase().includes(search.toLowerCase())).map(user => <tr key={user.userId}>
        <td className="p-3 border-b"><p className="font-semibold">{user.fullName || user.username}</p><p>{user.email}</p><p className="text-xs text-slate-500">{user.username}</p></td>
        <td className="p-3 border-b capitalize">{label(user.role)}</td><td className="p-3 border-b capitalize">{user.modules.join(', ')}</td><td className="p-3 border-b">{user.status}{user.isTemporaryPassword && <p className="text-xs text-amber-700">Password change required</p>}</td>
        <td className="p-3 border-b"><div className="flex gap-2"><Button variant="outline" disabled={busy || Boolean(credentials)} onClick={() => setForm({ ...user })}>Edit account</Button><Button variant="outline" disabled={busy || Boolean(credentials)} onClick={() => {
          if (window.confirm(`Reset ${user.username}'s password and sign them out?`)) run(async () => { const result = await staffAPI.resetPassword(user.userId); setCredentials(result.credentials); setUsers(previous => previous.map(row => row.userId === user.userId ? { ...row, isTemporaryPassword: true } : row)); });
        }}>Reset password</Button><Button variant="outline" className="text-red-700" disabled={busy || Boolean(credentials)} onClick={() => {
          if (window.confirm(`Permanently delete ${user.fullName || user.username} (${user.username})? They will lose access immediately. Historical records and audit logs will be retained. This cannot be undone.`)) run(async () => {
            await staffAPI.remove(user.userId);
            setUsers(previous => previous.filter(row => row.userId !== user.userId));
            if (form?.userId === user.userId) setForm(null);
          });
        }}>Delete</Button></div></td>
      </tr>)}</tbody></table>{!loadingList && !listError && !users.length && <p className="py-4 text-slate-500">No staff accounts yet.</p>}{users.length > 0 && !users.some(user => `${user.fullName || ''} ${user.username} ${user.email}`.toLowerCase().includes(search.toLowerCase())) && <p className="py-4 text-slate-500">No staff match this search. Clear the search to see all accounts.</p>}</div>
  </section>;
}
