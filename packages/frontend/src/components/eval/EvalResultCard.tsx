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
  isNew?: boolean;
}

const statusBadge: Record<EvalResultStatus, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  passed: 'success',
  failed: 'error',
  errored: 'warning',
  running: 'info',
  pending: 'default',
};

const flashBorder: Partial<Record<EvalResultStatus, string>> = {
  passed: 'border-green-700/60 bg-green-900/10',
  failed: 'border-red-700/60 bg-red-900/10',
  errored: 'border-yellow-700/60 bg-yellow-900/10',
};

export function EvalResultCard({
  caseName,
  status,
  score,
  reasoning,
  rawResponse,
  latencyMs,
  isNew,
}: EvalResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors duration-700 ${
        isNew && flashBorder[status]
          ? flashBorder[status]
          : 'bg-surface-raised border-border'
      }`}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative inline-flex items-center">
            {status === 'running' && (
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
            <Badge variant={statusBadge[status]}>{status}</Badge>
          </span>
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
