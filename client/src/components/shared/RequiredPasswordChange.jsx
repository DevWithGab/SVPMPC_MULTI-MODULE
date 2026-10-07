import { useState } from 'react';
import { authAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function RequiredPasswordChange({ user, onComplete, onLogout }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setError('');
    if (password !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try { await authAPI.changePassword(user.userId, current, password); onComplete({ ...user, isTemporaryPassword: false }); }
    catch (e) { setError(e.response?.data?.message || 'Unable to change password.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><form onSubmit={submit} className="bg-white rounded-xl border p-8 space-y-5 w-full max-w-md">
    <h1 className="text-2xl font-bold">Set your password</h1><p>Change your temporary password before accessing the system.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <label className="block">Temporary password<Input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="block">New password<Input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /><span className="text-sm text-slate-500">Use at least 12 characters.</span></label>
    <label className="block">Confirm new password<Input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <div className="flex gap-3"><Button disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button><Button type="button" variant="outline" onClick={onLogout}>Sign out</Button></div>
  </form></main>;
}
