import { Link } from 'react-router-dom';

const STATUS = {
  success: { dot: 'bg-cyan-500',   text: 'text-cyan-700',  bg: 'bg-cyan-50 border-cyan-200',  label: 'Success'  },
  failed:  { dot: 'bg-red-500',    text: 'text-red-700',   bg: 'bg-red-50 border-red-200',    label: 'Failed'   },
  timeout: { dot: 'bg-amber-500',  text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',label: 'Timeout'  },
  running: { dot: 'bg-blue-500',   text: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',  label: 'Running'  },
  pending: { dot: 'bg-slate-300',  text: 'text-slate-500', bg: 'bg-slate-50 border-slate-200',label: 'Pending'  },
};

export default function JobCard({ job, onDelete, onTrigger }) {
  const s        = STATUS[job.last_status] || STATUS.pending;
  const total    = parseInt(job.total_executions || 0);
  const succRate = total > 0 ? Math.round((parseInt(job.success_count || 0) / total) * 100) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link to={`/jobs/${job.id}`}
                className="font-display font-semibold text-slate-900 hover:text-cyan-700 transition-colors">
                {job.name}
              </Link>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.text}`}>
                {s.label}
              </span>
              {!job.is_active && (
                <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
                  Paused
                </span>
              )}
              {job.consecutive_failures >= (job.alert_after_failures || 3) && (
                <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  ⚠ {job.consecutive_failures} failures
                </span>
              )}
            </div>
            <p className="text-slate-400 font-mono text-xs mt-0.5 truncate">{job.url}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span className="font-mono">{job.schedule}</span>
              <span>·</span>
              <span>{job.method}</span>
              {total > 0 && <><span>·</span><span>{total} runs</span></>}
              {succRate !== null && <><span>·</span><span className={succRate >= 90 ? 'text-cyan-600' : 'text-amber-600'}>{succRate}% success</span></>}
              {job.next_run_at && (
                <><span>·</span><span>Next: {formatRelative(new Date(job.next_run_at))}</span></>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onTrigger} title="Run now"
            className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <Link to={`/jobs/${job.id}`}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <button onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelative(date) {
  const diff = date - Date.now();
  if (diff < 0) return 'overdue';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
