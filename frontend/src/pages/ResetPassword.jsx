import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    try { const { data } = await api.post('/auth/reset-password', { token, password }); setMessage(data.message); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Unable to reset password.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className="w-full max-w-sm">
    <div className="flex items-center gap-2 mb-10"><span className="text-xl">⏰</span><span className="font-display font-bold text-lg">CronHub</span></div>
    <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">Choose a new password</h1><p className="text-slate-500 text-sm mb-8">Use at least 8 characters.</p>
    {!token ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">This reset link is invalid.</div> : message ?
      <div><div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">{message}</div><Link to="/login" className="block text-center text-sm mt-6 hover:underline">Continue to sign in</Link></div> :
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
        <input type="password" placeholder="New password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={inputClass} />
        <input type="password" placeholder="Confirm new password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className={inputClass} />
        <button disabled={busy} className="w-full py-2.5 bg-slate-900 text-white font-medium text-sm rounded-lg disabled:opacity-50">{busy ? 'Resetting…' : 'Reset password'}</button>
      </form>}
  </div></div>;
}

const inputClass = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white';
