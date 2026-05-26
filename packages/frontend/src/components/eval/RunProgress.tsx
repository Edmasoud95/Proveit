interface RunProgressProps {
  completed: number;
  total: number;
  passed: number;
  failed: number;
}

export function RunProgress({ completed, total, passed, failed }: RunProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">Running evals… {completed}/{total}</span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="text-green-400">{passed} passed</span>
        <span className="text-red-400">{failed} failed</span>
      </div>
    </div>
  );
}
