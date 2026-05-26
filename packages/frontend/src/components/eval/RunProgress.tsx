interface RunProgressProps {
  completed: number;
  total: number;
  passed: number;
  failed: number;
}

export function RunProgress({ completed, total, passed, failed }: RunProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const passedPct = total > 0 ? (passed / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;
  const pending = total - completed;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">
          Running evals… <span className="font-medium text-white">{completed}/{total}</span>
        </span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-overlay overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${passedPct}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${failedPct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="text-green-400">{passed} passed</span>
        <span className="text-red-400">{failed} failed</span>
        {pending > 0 && <span>{pending} pending</span>}
      </div>
    </div>
  );
}
