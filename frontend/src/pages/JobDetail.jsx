import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import Header              from '../components/Header';
import JobModal            from '../components/JobModal';
import ExecutionTimeline   from '../components/ExecutionTimeline';

const STATUS_STYLE = {
  success: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  failed:  'text-red-700 bg-red-50 border-red-200',
  timeout: 'text-amber-700 bg-amber-50 border-amber-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
  pending: 'text-slate-500 bg-slate-50 border-slate-200',
};

export default function JobDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [job,        setJob]        = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    try {
      const [jobRes, execRes] = await Promise.all([
        api.get(`/jobs/${id}`),
        api.get(`/jobs/${id}/executions?limit=60`),
      ]);
      setJob(jobRes.data);
      setExecutions(execRes.data);
    } catch (err) {
      if (err.response?.status === 404) navigate('/', { replace: true });
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate(data) {
    const res = await api.put(`/jobs/${id}`, data);
    setJob(res.data);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${job.name}" and all its execution history?`)) return;
    await api.delete(`/jobs/${id}`);
    navigate('/', { replace: true });
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      await api.post(`/jobs/${id}/trigger`);
      setTimeout(load, 2500); // refresh after short delay
    } catch (err) {
      alert(err.response?.data?.error || 'Trigger failed');
    } finally { setTimeout(() => setTriggering(false), 2500); }
  }

  if (loading) return <Shell><LoadingState /></Shell>;
  if (!job) return null;

  const s        = STATUS_STYLE[job.last_status] || STATUS_STYLE.pending;
  const recent10 = executions.slice(0, 10);
  const successCount = executions.filter(e => e.status === 'success').length;
  const successRate  = executions.length > 0
    ? Math.round((successCount / executions.length) * 100) : null;

  return (
    <Shell>
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All jobs
      </Link>

      {/* Job header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="font-display font-bold text-2xl text-slate-900">{job.name}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${s}`}>
                {job.last_status || 'pending'}
              </span>
              {!job.is_active && (
                <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Paused</span>
              )}
            </div>
            <p className="font-mono text-sm text-slate-400 truncate">{job.url}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="font-mono">{job.schedule}</span>
              <span>·</span>
              <span>{job.method}</span>
              <span>·</span>
              <span>Timeout {job.timeout_seconds}s</span>
              <span>·</span>
              <span>{job.retry_count} retr{job.retry_count === 1 ? 'y' : 'ies'}</span>
              {job.next_run_at && (
                <><span>·</span><span>Next run {formatRelative(new Date(job.next_run_at))}</span></>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleTrigger} disabled={triggering}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-50 disabled:opacity-50 transition-colors">
              {triggering ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
              {triggering ? 'Running…' : 'Run now'}
            </button>
            <button onClick={() => setEditing(true)}
              className="px-3.5 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Edit
            </button>
            <button onClick={handleDelete}
              className="px-3.5 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              Delete
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <Metric label="Total runs"          value={executions.length} />
          <Metric label="Success rate"        value={successRate !== null ? `${successRate}%` : '—'} />
          <Metric label="Consecutive failures" value={job.consecutive_failures || 0} />
          <Metric label="Last run"            value={job.last_run_at ? formatRelative(new Date(job.last_run_at)) : 'Never'} />
        </div>
      </div>

      {/* Execution timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <h2 className="font-display font-semibold text-slate-900 mb-4">Execution history</h2>
        <ExecutionTimeline executions={executions} />
      </div>

      {/* Recent executions table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-slate-900 mb-4">Recent runs</h2>
        {recent10.length === 0 ? (
          <p className="text-slate-400 text-sm">No executions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Status','Started','Duration','HTTP','Attempt','Trigger','Error'].map(h => (
                    <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wide font-medium pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent10.map(exec => (
                  <tr key={exec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[exec.status] || STATUS_STYLE.pending}`}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(exec.started_at).toLocaleString('en-US', {
                        month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false,
                      })}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">
                      {exec.duration_ms != null ? `${exec.duration_ms}ms` : '—'}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                      {exec.status_code || '—'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500">{exec.attempt}</td>
                    <td className="py-3 pr-4 text-xs text-slate-400 capitalize">{exec.triggered_by}</td>
                    <td className="py-3 text-xs text-red-500 max-w-[200px] truncate" title={exec.error_message || ''}>
                      {exec.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <JobModal job={job} onSave={handleUpdate} onClose={() => setEditing(false)} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className="font-mono text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 bg-slate-200 rounded w-20" />
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-4 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function formatRelative(date) {
  const diff = Math.abs(Date.now() - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
