import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();
  const set = e  => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setErr(''); };

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try {
      const res = await api.post(mode === 'login' ? '/auth/login' : '/auth/register',
        mode === 'login' ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      navigate('/', { replace: true });
    } catch (err) { setErr(err.response?.data?.error || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:flex flex-col justify-between w-5/12 bg-slate-900 p-12">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏰</span>
          <span className="font-display font-bold text-white text-xl">CronHub</span>
        </div>
        <div>
          <h2 className="text-white font-display font-bold text-3xl leading-tight mb-6">
            Schedule any HTTP job.<br />Never miss a cron again.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Register any HTTP endpoint with a cron expression. CronHub calls it on schedule, logs every run, retries failures with exponential backoff, and alerts you when things go wrong.
          </p>
          {[
            { icon: '🔁', text: 'Exponential backoff retry on failure' },
            { icon: '📊', text: 'Execution timeline with response logs' },
            { icon: '🔔', text: 'Email + webhook alerts on consecutive failures' },
            { icon: '▶️', text: 'Manual trigger from the dashboard' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 mb-3">
              <span>{icon}</span>
              <span className="text-slate-300 text-sm">{text}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs">Self-hostable · No subscription · Open source</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span className="text-xl">⏰</span>
            <span className="font-display font-bold text-slate-900 text-lg">CronHub</span>
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 mb-1">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {mode === 'login' ? 'Manage your scheduled jobs' : 'Start scheduling HTTP jobs'}
          </p>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-5">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && <input name="name" value={form.name} onChange={set} placeholder="Your name" required className={inp()} />}
            <input type="email" name="email" value={form.email} onChange={set} placeholder="Email" required className={inp()} />
            <input type="password" name="password" value={form.password} onChange={set} placeholder="Password" required minLength={mode === 'register' ? 8 : 1} className={inp()} />
            {mode === 'login' && <div className="text-right"><Link to="/forgot-password" className="text-xs text-slate-600 hover:underline">Forgot password?</Link></div>}
            <button type="submit" disabled={busy} className="w-full py-2.5 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-400 mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
            <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setErr(''); }}
              className="text-slate-700 font-medium hover:underline">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const inp = () => 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white transition';
