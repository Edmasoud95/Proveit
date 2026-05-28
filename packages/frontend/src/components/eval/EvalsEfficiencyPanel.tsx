import { useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { EvalRun } from '@proveit/shared';

const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171', '#a78bfa', '#fb923c'];

interface Props {
  runs: EvalRun[];
}

interface ModelPoint {
  accuracyPct: number;
  tokensPerSecond: number;
  efficiencyScore: number;
  avgLatencyMs: number;
  model: string;
  runCount: number;
  color: string;
}

interface TooltipPayload {
  payload: ModelPoint;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function groupByModel(runs: EvalRun[]): ModelPoint[] {
  const eligible = runs.filter(
    (r) => r.metrics?.tokensPerSecond != null && r.metrics?.accuracy != null,
  );

  const byModel = new Map<string, EvalRun[]>();
  for (const r of eligible) {
    const key = r.snapshotModel;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key)!.push(r);
  }

  return Array.from(byModel.entries()).map(([model, modelRuns], i) => ({
    model,
    runCount: modelRuns.length,
    accuracyPct: avg(modelRuns.map((r) => r.metrics!.accuracy! * 100)),
    tokensPerSecond: avg(modelRuns.map((r) => r.metrics!.tokensPerSecond!)),
    efficiencyScore: avg(modelRuns.map((r) => r.metrics!.efficiencyScore ?? 0)),
    avgLatencyMs: avg(modelRuns.map((r) => r.metrics!.avgLatencyMs ?? 0)),
    color: PALETTE[i % PALETTE.length],
  }));
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <div className="font-semibold text-white mb-1">{d.model}</div>
      <div className="text-gray-400 mb-1">{d.runCount} run{d.runCount !== 1 ? 's' : ''} averaged</div>
      <div className="text-gray-300">Accuracy: <span className="text-white">{d.accuracyPct.toFixed(1)}%</span></div>
      <div className="text-gray-300">Speed: <span className="text-white">{d.tokensPerSecond.toFixed(1)} t/s</span></div>
      <div className="text-gray-300">Avg Latency: <span className="text-white">{d.avgLatencyMs.toFixed(0)} ms</span></div>
      <div className="text-gray-300">Efficiency: <span className="text-white">{d.efficiencyScore.toFixed(2)}</span></div>
    </div>
  );
}

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ModelPoint };
  return <circle cx={cx} cy={cy} r={7} fill={payload.color} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />;
}

export function EvalsEfficiencyPanel({ runs }: Props) {
  const [show80Line, setShow80Line] = useState(false);

  const points = groupByModel(runs);

  if (points.length < 1) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-sm">Run evals to see efficiency data</p>
      </div>
    );
  }

  const ranked = [...points].sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Accuracy vs Speed</h3>
          <p className="text-xs text-gray-400 mt-0.5">Up and to the right = better on both dimensions</p>
        </div>
        <button
          onClick={() => setShow80Line((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            show80Line
              ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'
          }`}
        >
          80% target line
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            dataKey="accuracyPct"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            label={{ value: 'Accuracy →', position: 'insideBottom', offset: -15, fill: '#9ca3af', fontSize: 11 }}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="tokensPerSecond"
            scale="log"
            domain={['auto', 'auto']}
            label={{ value: 'Speed (t/s)', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af', fontSize: 11 }}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          />
          <Tooltip content={<CustomTooltip />} />
          {show80Line && (
            <ReferenceLine x={80} stroke="#6366f1" strokeDasharray="6 3" label={{ value: '80%', fill: '#6366f1', fontSize: 10 }} />
          )}
          {points.map((pt) => (
            <Scatter
              key={pt.model}
              name={pt.model}
              data={[pt]}
              fill={pt.color}
              shape={<CustomDot />}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3">
        {points.map((pt) => (
          <div key={pt.model} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pt.color }} />
            {pt.model}
            {pt.runCount > 1 && <span className="text-gray-500">({pt.runCount} runs)</span>}
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="text-xs font-semibold text-gray-300 mb-2">Efficiency Ranking</h4>
        <div className="space-y-1.5">
          {ranked.map((pt, i) => (
            <div key={pt.model} className="flex items-center gap-3 text-xs">
              <span className="text-gray-500 w-4 text-right">{i + 1}.</span>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pt.color }} />
              <span className="text-gray-300 flex-1 truncate">{pt.model}</span>
              <span className="text-gray-500">{pt.runCount}×</span>
              <span className="text-gray-400">{pt.accuracyPct.toFixed(0)}%</span>
              <span className="text-gray-400">{pt.tokensPerSecond.toFixed(1)} t/s</span>
              <span className="text-indigo-300 font-mono">{pt.efficiencyScore.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
