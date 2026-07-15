import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EvalCase } from '@proveit/shared';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../../services/api';

interface EvalCasesListProps {
  pocId: string;
  cases: EvalCase[];
  addingNew?: boolean;
  onAddComplete?: () => void;
}

export function EvalCasesList({ pocId, cases, addingNew, onAddComplete }: EvalCasesListProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftCriteria, setDraftCriteria] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingNew) {
      setDraftName('');
      setDraftMessage('');
      setDraftCriteria('');
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [addingNew]);

  const deleteMutation = useMutation({
    mutationFn: (caseId: string) => api.delete(`/pocs/${pocId}/evals/cases/${caseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      setConfirmDeleteId(null);
    },
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/pocs/${pocId}/evals`, {
        cases: [{ name: draftName, input: { messages: [{ role: 'user', content: draftMessage }] }, judgeCriteria: draftCriteria }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      onAddComplete?.();
    },
  });

  const draftValid = draftName.trim() && draftMessage.trim() && draftCriteria.trim();

  return (
    <div className="flex flex-col gap-2">
      {cases.length === 0 && !addingNew && (
        <p className="text-sm text-muted text-center py-6">No eval cases yet.</p>
      )}

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

      {addingNew && (
        <Card className="flex flex-col gap-3">
          <Input
            ref={nameRef}
            label="Name"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            placeholder="e.g. Handles missing order ID"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-300 font-medium">User message</label>
            <textarea
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              placeholder="What the user says to the agent"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border text-gray-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-300 font-medium">Judge criteria</label>
            <textarea
              value={draftCriteria}
              onChange={e => setDraftCriteria(e.target.value)}
              placeholder="Specific, measurable pass/fail criteria for the LLM judge"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border text-gray-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
            />
          </div>
          {addMutation.isError && (
            <p className="text-xs text-red-400">Failed to save. Please try again.</p>
          )}
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => onAddComplete?.()}>Cancel</Button>
            <Button size="sm" onClick={() => addMutation.mutate()} loading={addMutation.isPending} disabled={!draftValid}>
              Save case
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
