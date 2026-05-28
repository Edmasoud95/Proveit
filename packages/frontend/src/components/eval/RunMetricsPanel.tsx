import type { RunMetrics } from '@proveit/shared';

interface Props {
  metrics: RunMetrics | null;
  label: string;
}

function fmt(value: number | null | undefined, decimals = 0, suffix = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals)}${suffix}`;
}

export function RunMetricsPanel({ metrics, label }: Props) {
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{label}</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Accuracy</span>
          <span className="text-white font-mono">
            {metrics?.accuracy != null ? `${(metrics.accuracy * 100).toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Avg Latency</span>
          <span className="text-white font-mono">{fmt(metrics?.avgLatencyMs, 0, ' ms')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Token Usage</span>
          <span className="text-white font-mono text-right">
            {metrics?.avgPromptTokens != null
              ? `${metrics.avgPromptTokens.toFixed(0)}p / ${(metrics.avgCompletionTokens ?? 0).toFixed(0)}c / ${(metrics.avgTotalTokens ?? 0).toFixed(0)}t`
              : '—'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Efficiency Score</span>
          <span className="text-white font-mono">{fmt(metrics?.efficiencyScore, 2)}</span>
        </div>
      </div>
    </div>
  );
}
