import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const { data } = await api.post('/auth/forgot-password', { email }); setMessage(data.message); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Unable to request a reset link.'); }
    finally { setBusy(false); }
  }
  return <Shell title="Forgot your password?" subtitle="Enter your account email and we’ll send a secure reset link.">
    {message ? <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">{message}</div> :
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
        <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={inputClass} /></label>
        <button disabled={busy} className="w-full py-2.5 bg-slate-900 text-white font-medium text-sm rounded-lg disabled:opacity-50">{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>}
    <Link to="/login" className="block text-center text-sm text-slate-600 hover:underline mt-6">Back to sign in</Link>
  </Shell>;
}

function Shell({ title, subtitle, children }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8"><div className="w-full max-w-sm">
    <div className="flex items-center gap-2 mb-10"><span className="text-xl">⏰</span><span className="font-display font-bold text-lg">CronHub</span></div>
    <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">{title}</h1><p className="text-slate-500 text-sm mb-8">{subtitle}</p>{children}
  </div></div>;
}

const inputClass = 'w-full mt-1.5 px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white';
