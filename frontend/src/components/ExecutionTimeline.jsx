/**
 * ExecutionTimeline
 * Shows the last N executions as coloured dots — like a heartbeat strip.
 * Hover over a dot to see status, duration, and timestamp.
 */
export default function ExecutionTimeline({ executions = [] }) {
  if (!executions.length) {
    return <p className="text-slate-400 text-sm text-center py-6">No executions yet.</p>;
  }

  const dots = [...executions].reverse().slice(-60); // oldest → newest, max 60

  const successRate = Math.round(
    (executions.filter(e => e.status === 'success').length / executions.length) * 100
  );

  const avgDuration = Math.round(
    executions.filter(e => e.duration_ms).reduce((a, e) => a + e.duration_ms, 0) /
    Math.max(executions.filter(e => e.duration_ms).length, 1)
  );

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-3 text-xs text-slate-500">
        <span>
          <span className="font-mono font-semibold text-slate-800">{successRate}%</span> success
        </span>
        <span>
          <span className="font-mono font-semibold text-slate-800">{avgDuration}ms</span> avg
        </span>
        <span>
          <span className="font-mono font-semibold text-slate-800">{executions.length}</span> total
        </span>
      </div>

      {/* Dot strip */}
      <div className="flex items-end gap-0.5 h-10">
        {dots.map((exec) => (
          <Dot key={exec.id} exec={exec} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { color: 'bg-cyan-500',  label: 'Success' },
          { color: 'bg-red-500',   label: 'Failed'  },
          { color: 'bg-amber-400', label: 'Timeout' },
          { color: 'bg-blue-400',  label: 'Running' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-sm ${color}`} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dot({ exec }) {
  const colors = {
    success: 'bg-cyan-500 hover:bg-cyan-400',
    failed:  'bg-red-500 hover:bg-red-400',
    timeout: 'bg-amber-400 hover:bg-amber-300',
    running: 'bg-blue-400 hover:bg-blue-300',
  };

  const color = colors[exec.status] || 'bg-slate-300';

  const label = [
    exec.status.toUpperCase(),
    exec.status_code ? `HTTP ${exec.status_code}` : null,
    exec.duration_ms ? `${exec.duration_ms}ms` : null,
    new Date(exec.started_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }),
    exec.error_message || null,
  ].filter(Boolean).join(' · ');

  // Bar height proportional to response time (capped at 100% = 2000ms)
  const maxMs  = 2000;
  const height = exec.duration_ms
    ? Math.max(20, Math.min(100, (exec.duration_ms / maxMs) * 100))
    : 30;

  return (
    <div
      className={`flex-1 max-w-[14px] rounded-t cursor-pointer transition-all ${color} relative group`}
      style={{ height: `${height}%` }}
      title={label}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none min-w-max">
        <div className="bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-xl max-w-xs text-center">
          {label.split(' · ').map((line, i) => (
            <div key={i} className={i === 0 ? 'font-semibold' : 'text-slate-300'}>{line}</div>
          ))}
        </div>
        <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}
