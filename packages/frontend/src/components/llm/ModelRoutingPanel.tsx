import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LlmRoutingConfig, TaskType } from '@proveit/shared';
import { api } from '../../services/api';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { resolveEffectiveProvider } from '../../hooks/useRouting';

const TASK_TYPES: { type: TaskType; label: string }[] = [
  { type: 'agent', label: 'Agent (eval runs)' },
  { type: 'judge', label: 'Judge (scoring)' },
  { type: 'eval-gen', label: 'Eval Generation' },
  { type: 'stub-gen', label: 'Stub Generation' },
];

interface ModelRoutingPanelProps {
  pocId: string;
  routing: LlmRoutingConfig | undefined;
}

export function ModelRoutingPanel({ pocId, routing }: ModelRoutingPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRouting, setShowRouting] = useState(false);

  const setRoutingMutation = useMutation({
    mutationFn: ({ taskType, connectionId, model }: { taskType: string; connectionId: string; model: string }) =>
      api.put(`/pocs/${pocId}/llm/routing/${taskType}`, { connectionId, model }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing', pocId] }),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update routing', 'error'),
  });

  const clearRoutingMutation = useMutation({
    mutationFn: (taskType: string) => api.delete(`/pocs/${pocId}/llm/routing/${taskType}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing', pocId] }),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to clear routing', 'error'),
  });

  return (
    <Card className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setShowRouting((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-semibold text-gray-300">Advanced model routing</span>
        <span className="text-xs text-muted">{showRouting ? '▾' : '▸'}</span>
      </button>

      {showRouting && (
        <div className="flex flex-col gap-0 border-t border-border pt-3">
          <p className="text-xs text-muted mb-3">
            Override which provider and model handles each task type. Leave at "Default" to use the default provider.
          </p>
          {TASK_TYPES.map(({ type, label }) => {
            const allProviders = routing?.providers ?? [];
            const override = routing?.overrides.find((o) => o.taskType === type);
            const selectedProvider = override
              ? allProviders.find((p) => p.id === override.connectionId)
              : null;
            const effective = resolveEffectiveProvider(routing, type);
            const isOverrideInactive = selectedProvider && !selectedProvider.isActive && !!selectedProvider.lastCheckedAt;

            return (
              <div key={type} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span className="text-sm text-gray-400 w-40 shrink-0">{label}</span>
                <select
                  value={override?.connectionId ?? ''}
                  onChange={(e) => {
                    const connId = e.target.value;
                    if (!connId) {
                      clearRoutingMutation.mutate(type);
                    } else {
                      const provider = allProviders.find((p) => p.id === connId);
                      const defaultModel = provider?.model ?? '';
                      setRoutingMutation.mutate({ taskType: type, connectionId: connId, model: override?.connectionId === connId ? (override?.model ?? defaultModel) : defaultModel });
                    }
                  }}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-accent/60"
                >
                  <option value="">Default</option>
                  {allProviders.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.isGlobal ? ' (global)' : ''}</option>
                  ))}
                </select>
                {override && (
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
                      title="Clear override"
                      className="text-gray-500 hover:text-red-400 transition-colors text-sm px-1"
                    >
                      ×
                    </button>
                  </>
                )}
                {!override && (
                  <span className="text-xs text-muted font-mono flex-1">
                    {effective
                      ? `${effective.provider.name} · ${effective.model}${effective.source === 'global-default' ? ' (global default)' : ''}`
                      : '—'}
                  </span>
                )}
                {isOverrideInactive && (
                  <span title="Provider unreachable" className="text-amber-400 text-sm">⚠</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
