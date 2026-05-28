import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EvalCase } from '@proveit/shared';
import { Card } from '../ui/Card';
import { api } from '../../services/api';

interface EvalCasesListProps {
  pocId: string;
  cases: EvalCase[];
}

export function EvalCasesList({ pocId, cases }: EvalCasesListProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (caseId: string) => api.delete(`/pocs/${pocId}/evals/cases/${caseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      setConfirmDeleteId(null);
    },
  });

  if (cases.length === 0) {
    return <p className="text-sm text-muted text-center py-6">No eval cases yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {cases.map((c) => (
        <Card key={c.id} className="hover:border-border/80 transition-colors">
          <div className="flex items-center justify-between">
            <span
              className="text-sm font-medium text-gray-200 cursor-pointer flex-1"
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
            >
              {c.name}
            </span>
            <div className="flex items-center gap-2">
              {confirmDeleteId === c.id ? (
                <>
                  <span className="text-xs text-gray-400">Delete?</span>
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                    className="px-2 py-0.5 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-0.5 text-xs rounded border border-border text-muted hover:text-white transition-colors"
                  >
                    No
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                  className="text-muted hover:text-red-400 transition-colors text-xs px-1"
                  title="Delete eval case"
                >
                  ✕
                </button>
              )}
              <span
                className="text-muted text-xs cursor-pointer"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                {expandedId === c.id ? '▾' : '▸'}
              </span>
            </div>
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
