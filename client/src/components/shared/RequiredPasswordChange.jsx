import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../../services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

function PasswordField({ id, label, hint, ...props }) {
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor={id} className="block">{label}</label>
    <div className="relative">
      <Input {...props} id={id} type={visible ? 'text' : 'password'} className="pr-12" aria-describedby={hint ? `${id}-hint` : undefined} />
      <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-600" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
    {hint && <p id={`${id}-hint`} className="text-sm text-slate-500">{hint}</p>}
  </div>;
}

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
    <PasswordField id="temporary-password" label="Temporary password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
    <PasswordField id="new-password" label="New password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} hint="Use at least 12 characters." />
    <PasswordField id="confirm-password" label="Confirm new password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
    <div className="flex gap-3"><Button disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button><Button type="button" variant="outline" onClick={onLogout}>Sign out</Button></div>
  </form></main>;
}
