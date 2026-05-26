import { useState } from 'react';
import type { EvalCase } from '@proveit/shared';
import { Card } from '../ui/Card';

interface EvalCasesListProps {
  cases: EvalCase[];
}

export function EvalCasesList({ cases }: EvalCasesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (cases.length === 0) {
    return <p className="text-sm text-muted text-center py-6">No eval cases yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {cases.map((c) => (
        <Card
          key={c.id}
          className="cursor-pointer hover:border-border/80 transition-colors"
          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-200">{c.name}</span>
            <span className="text-muted text-xs">{expandedId === c.id ? '▾' : '▸'}</span>
          </div>
          {expandedId === c.id && (
            <div className="mt-3 flex flex-col gap-3 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">Input</p>
                <pre className="text-xs text-gray-300 bg-surface-overlay rounded-lg p-3 overflow-auto">
                  {JSON.stringify(c.input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">Judge criteria</p>
                <p className="text-sm text-gray-300">{c.judgeCriteria}</p>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
