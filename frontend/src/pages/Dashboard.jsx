import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import Header   from '../components/Header';
import JobCard  from '../components/JobCard';
import JobModal from '../components/JobModal';

export default function Dashboard() {
  const [jobs,      setJobs]    = useState([]);
  const [loading,   setLoading] = useState(true);
  const [showModal, setShow]    = useState(false);

  const fetchJobs = useCallback(async () => {
    try { const r = await api.get('/jobs'); setJobs(r.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  async function handleCreate(data) {
    const res = await api.post('/jobs', data);
    setJobs(p => [res.data, ...p]);
    setShow(false);
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await api.delete(`/jobs/${id}`);
    setJobs(p => p.filter(j => j.id !== id));
  }

  async function handleTrigger(job) {
    try {
      await api.post(`/jobs/${job.id}/trigger`);
      // Brief wait then refresh to show new execution
      setTimeout(fetchJobs, 2000);
    } catch (err) {
      alert(err.response?.data?.error || 'Trigger failed');
    }
  }

  const active   = jobs.filter(j => j.is_active).length;
  const failing  = jobs.filter(j => j.last_status === 'failed' || j.last_status === 'timeout').length;
  const totalRuns = jobs.reduce((a, j) => a + parseInt(j.total_executions || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Total jobs"  value={jobs.length} />
          <Stat label="Active"      value={active}      color="cyan" />
          <Stat label="Failing"     value={failing}     color={failing > 0 ? 'red' : undefined} />
          <Stat label="Total runs"  value={totalRuns.toLocaleString()} />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display font-bold text-xl text-slate-900">Scheduled Jobs</h1>
          <button onClick={() => setShow(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New job
          </button>
        </div>

        {loading ? <Skeleton /> : jobs.length === 0 ? (
          <EmptyState onNew={() => setShow(true)} />
        ) : (
          <div className="space-y-3">
            {jobs.map(j => (
              <JobCard key={j.id} job={j}
                onDelete={() => handleDelete(j.id, j.name)}
                onTrigger={() => handleTrigger(j)} />
            ))}
          </div>
        )}
      </main>

      {showModal && <JobModal onSave={handleCreate} onClose={() => setShow(false)} />}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = { cyan: 'text-cyan-600', red: 'text-red-600' };
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">{label}</p>
      <p className={`font-mono text-3xl font-bold mt-1 ${colors[color] || 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
      <div className="text-5xl mb-4 select-none">⏰</div>
      <h3 className="font-display font-semibold text-slate-700 text-lg mb-1.5">No jobs yet</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
        Schedule your first HTTP job with any cron expression.
      </p>
      <button onClick={onNew}
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
        Create your first job
      </button>
    </div>
  );
}
