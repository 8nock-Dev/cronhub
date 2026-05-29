import { useState, useEffect } from 'react';
import api from '../api/client';

const METHODS  = ['GET','POST','PUT','PATCH','DELETE','HEAD'];
const PRESETS  = [
  { label: 'Every minute',       value: '* * * * *'    },
  { label: 'Every 5 minutes',    value: '*/5 * * * *'  },
  { label: 'Every 15 minutes',   value: '*/15 * * * *' },
  { label: 'Every 30 minutes',   value: '*/30 * * * *' },
  { label: 'Every hour',         value: '0 * * * *'    },
  { label: 'Every day at 9am',   value: '0 9 * * *'    },
  { label: 'Every Monday 9am',   value: '0 9 * * 1'    },
  { label: 'First of month',     value: '0 9 1 * *'    },
];

const DEFAULTS = {
  name: '', url: '', method: 'GET', schedule: '*/5 * * * *',
  timezone: 'UTC', body: '', timeout_seconds: 30,
  retry_count: 2, retry_delay_seconds: 60,
  notify_email: '', notify_webhook: '', alert_after_failures: 3,
  is_active: true,
};

export default function JobModal({ job, onSave, onClose }) {
  const [f, setF]           = useState(DEFAULTS);
  const [loading, setL]     = useState(false);
  const [error, setErr]     = useState('');
  const [nextRun, setNext]  = useState(null);
  const [validating, setV]  = useState(false);
  const [tab, setTab]       = useState('basic');
  const isEdit = Boolean(job);

  useEffect(() => {
    if (job) setF({
      name:                job.name || '',
      url:                 job.url  || '',
      method:              job.method || 'GET',
      schedule:            job.schedule || '*/5 * * * *',
      timezone:            job.timezone || 'UTC',
      body:                job.body || '',
      timeout_seconds:     job.timeout_seconds || 30,
      retry_count:         job.retry_count || 2,
      retry_delay_seconds: job.retry_delay_seconds || 60,
      notify_email:        job.notify_email || '',
      notify_webhook:      job.notify_webhook || '',
      alert_after_failures:job.alert_after_failures || 3,
      is_active:           job.is_active ?? true,
    });
  }, [job]);

  // Validate cron on change
  useEffect(() => {
    if (!f.schedule) return;
    const t = setTimeout(async () => {
      setV(true);
      try {
        const res = await api.post('/jobs/validate-cron', { schedule: f.schedule, timezone: f.timezone });
        setNext(res.data.next_run ? new Date(res.data.next_run).toLocaleString() : null);
        setErr(prev => prev.includes('cron') ? '' : prev);
      } catch {
        setNext(null);
      } finally { setV(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [f.schedule, f.timezone]);

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(''); };

  async function submit(e) {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Name is required'); return; }
    if (!f.url.trim())  { setErr('URL is required');  return; }
    if (!f.schedule)    { setErr('Schedule is required'); return; }
    setL(true);
    try {
      await onSave({
        ...f,
        timeout_seconds:     Number(f.timeout_seconds),
        retry_count:         Number(f.retry_count),
        retry_delay_seconds: Number(f.retry_delay_seconds),
        alert_after_failures:Number(f.alert_after_failures),
        notify_email:  f.notify_email  || null,
        notify_webhook:f.notify_webhook|| null,
        body: f.body || null,
      });
    } catch (err) {
      setErr(err.response?.data?.error || 'Save failed');
    } finally { setL(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-display font-bold text-lg text-slate-900">
            {isEdit ? 'Edit job' : 'New cron job'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
          {['basic','request','alerts'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-1 py-2.5 mr-5 text-sm font-medium border-b-2 capitalize transition-colors ${
                tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            {/* ── Basic tab ── */}
            {tab === 'basic' && (
              <>
                <F label="Job name *">
                  <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Database backup" className={inp()} />
                </F>

                <F label="URL to call *">
                  <input value={f.url} onChange={e => set('url', e.target.value)} placeholder="https://api.myapp.com/cron/backup" className={inp()} />
                </F>

                <F label="Schedule (cron expression) *"
                  hint={validating ? 'Validating…' : nextRun ? `Next run: ${nextRun}` : 'Enter a valid 5-field cron expression'}>
                  <div className="flex gap-2">
                    <input value={f.schedule} onChange={e => set('schedule', e.target.value)}
                      placeholder="*/5 * * * *" className={`${inp()} font-mono flex-1`} />
                    <select onChange={e => { if (e.target.value) set('schedule', e.target.value); }}
                      value="" className={`${inp()} w-auto text-xs`}>
                      <option value="">Presets</option>
                      {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </F>

                <div className="grid grid-cols-2 gap-4">
                  <F label="Timeout (seconds)">
                    <input type="number" value={f.timeout_seconds} onChange={e => set('timeout_seconds', e.target.value)}
                      min={1} max={300} className={inp()} />
                  </F>
                  <F label="Retries on failure">
                    <input type="number" value={f.retry_count} onChange={e => set('retry_count', e.target.value)}
                      min={0} max={5} className={inp()} />
                  </F>
                </div>

                {isEdit && (
                  <Toggle label="Job active" checked={f.is_active} onChange={v => set('is_active', v)} />
                )}
              </>
            )}

            {/* ── Request tab ── */}
            {tab === 'request' && (
              <>
                <F label="HTTP method">
                  <select value={f.method} onChange={e => set('method', e.target.value)} className={inp()}>
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </F>
                <F label="Request body" hint="Only sent with POST, PUT, PATCH">
                  <textarea value={f.body} onChange={e => set('body', e.target.value)}
                    rows={4} placeholder='{"key": "value"}' className={`${inp()} font-mono resize-none`} />
                </F>
                <F label="Retry base delay (seconds)" hint="Doubles on each retry attempt">
                  <input type="number" value={f.retry_delay_seconds} onChange={e => set('retry_delay_seconds', e.target.value)}
                    min={1} className={inp()} />
                </F>
              </>
            )}

            {/* ── Alerts tab ── */}
            {tab === 'alerts' && (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-500">
                  Alerts fire when a job fails consecutively beyond the threshold below.
                </div>
                <F label="Alert after N consecutive failures">
                  <input type="number" value={f.alert_after_failures} onChange={e => set('alert_after_failures', e.target.value)}
                    min={1} max={20} className={inp()} />
                </F>
                <F label="Email alert">
                  <input type="email" value={f.notify_email} onChange={e => set('notify_email', e.target.value)}
                    placeholder="ops@yourcompany.com" className={inp()} />
                </F>
                <F label="Webhook (Slack, Discord, custom)">
                  <input value={f.notify_webhook} onChange={e => set('notify_webhook', e.target.value)}
                    placeholder="https://hooks.slack.com/…" className={inp()} />
                </F>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function F({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-cyan-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

const inp = () => 'w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white transition';
