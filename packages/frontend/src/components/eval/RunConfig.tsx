import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskType } from '@proveit/shared';
import { api } from '../../services/api';
import { resolveEffectiveProvider, useRouting } from '../../hooks/useRouting';

const ALL_TASK_TYPES: { type: TaskType; label: string }[] = [
  { type: 'agent', label: 'Agent' },
  { type: 'judge', label: 'Judge' },
];

interface RunConfigProps {
  pocId: string;
  /** Task types this surface actually uses (default: agent + judge, for eval runs). */
  tasks?: TaskType[];
  title?: string;
}

export function RunConfig({ pocId, tasks = ['agent', 'judge'], title = 'Models for this run' }: RunConfigProps) {
  const taskTypes = ALL_TASK_TYPES.filter((t) => tasks.includes(t.type));
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: routing } = useRouting(pocId);
  // POC providers and global providers alike — mirrors what the backend can route to.
  const providers = routing?.providers ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['routing', pocId] });

  const setRoutingMutation = useMutation({
    mutationFn: ({ taskType, connectionId, model }: { taskType: TaskType; connectionId: string; model: string }) =>
      api.put(`/pocs/${pocId}/llm/routing/${taskType}`, { connectionId, model }),
    onSuccess: invalidate,
  });

  const clearRoutingMutation = useMutation({
    mutationFn: (taskType: TaskType) => api.delete(`/pocs/${pocId}/llm/routing/${taskType}`),
    onSuccess: invalidate,
  });

  if (!providers.length) return null;

  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-overlay transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <div className="flex items-center gap-4">
          {!expanded &&
            taskTypes.map(({ type, label }) => {
              const eff = resolveEffectiveProvider(routing, type);
              return eff ? (
                <span key={type} className="text-xs text-muted hidden sm:block">
                  <span className="text-gray-500">{label}</span>{' '}
                  <span className="text-gray-400 font-mono">{eff.model}</span>
                  {eff.provider.isGlobal && <span className="text-gray-600"> · global</span>}
                </span>
              ) : null;
            })}
          <span className="text-xs text-blue-400">{expanded ? 'Done ▾' : 'Configure ▸'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 flex flex-col gap-2">
          {taskTypes.map(({ type, label }) => {
            const override = routing?.overrides.find((o) => o.taskType === type);
            const selectedProvider = providers.find((p) => p.id === override?.connectionId);
            const effective = resolveEffectiveProvider(routing, type);

            return (
              <div key={type} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-12 shrink-0">{label}</span>
                <select
                  value={override?.connectionId ?? ''}
                  onChange={(e) => {
                    const connId = e.target.value;
                    if (!connId) {
                      clearRoutingMutation.mutate(type);
                    } else {
                      const provider = providers.find((p) => p.id === connId);
                      const defaultModel = provider?.model ?? '';
                      setRoutingMutation.mutate({
                        taskType: type,
                        connectionId: connId,
                        model: override?.connectionId === connId ? (override?.model ?? defaultModel) : defaultModel,
                      });
                    }
                  }}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-accent/60"
                >
                  <option value="">Default</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isGlobal ? ' (global)' : ''}
                    </option>
                  ))}
                </select>
                {override ? (
                  <>
                    {selectedProvider?.availableModels && selectedProvider.availableModels.length > 0 ? (
                      <select
                        value={override.model}
                        onChange={(e) =>
                          setRoutingMutation.mutate({ taskType: type, connectionId: override.connectionId, model: e.target.value })
                        }
                        className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-accent/60"
                      >
                        {selectedProvider.availableModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={override.model}
                        onChange={(e) =>
                          setRoutingMutation.mutate({ taskType: type, connectionId: override.connectionId, model: e.target.value })
                        }
                        placeholder="model name"
                        className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-accent/60"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => clearRoutingMutation.mutate(type)}
                      title="Reset to default"
                      className="text-gray-500 hover:text-red-400 transition-colors text-sm px-1"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-muted font-mono flex-1">
                    {effective
                      ? `${effective.provider.name} · ${effective.model}${effective.source === 'global-default' ? ' (global default)' : ''}`
                      : '—'}
                  </span>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted mt-1">
            Full provider settings →{' '}
            <Link to={`/poc/${pocId}/llm`} className="text-blue-400 hover:text-blue-300">
              LLM Settings
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
