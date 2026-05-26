import { useState } from 'react';
import { Badge } from '../ui/Badge';
import type { EvalResultStatus } from '@proveit/shared';

interface EvalResultCardProps {
  caseId: string;
  caseName: string;
  status: EvalResultStatus;
  score?: number;
  reasoning?: string;
  rawResponse?: string;
  latencyMs?: number;
}

const statusBadge: Record<EvalResultStatus, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  passed: 'success',
  failed: 'error',
  errored: 'warning',
  running: 'info',
  pending: 'default',
};

export function EvalResultCard({
  caseName,
  status,
  score,
  reasoning,
  rawResponse,
  latencyMs,
}: EvalResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-raised border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant={statusBadge[status]}>{status}</Badge>
          <span className="text-sm font-medium text-gray-200 truncate">{caseName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {score !== undefined && (
            <span className="text-sm font-mono text-gray-400">{score}/10</span>
          )}
          {latencyMs !== undefined && (
            <span className="text-xs text-muted">{latencyMs}ms</span>
          )}
          <span className="text-muted text-xs">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border">
          {reasoning && (
            <div className="mt-3">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Judge reasoning</p>
              <p className="text-sm text-gray-300">{reasoning}</p>
            </div>
          )}
          {rawResponse && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Agent response</p>
              <pre className="text-xs text-gray-400 bg-surface-overlay rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
                {rawResponse}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
