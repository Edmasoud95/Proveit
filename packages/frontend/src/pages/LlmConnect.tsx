import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LlmProvider, LlmRoutingConfig, TaskType } from '@proveit/shared';
import { api } from '../services/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

const TASK_TYPES: { type: TaskType; label: string }[] = [
  { type: 'agent', label: 'Agent (eval runs)' },
  { type: 'judge', label: 'Judge (scoring)' },
  { type: 'eval-gen', label: 'Eval Generation' },
  { type: 'stub-gen', label: 'Stub Generation' },
];

type ProviderForm = { name: string; endpointUrl: string; apiKey: string; model: string };
const emptyForm = (): ProviderForm => ({ name: '', endpointUrl: 'http://localhost:1234/v1', apiKey: '', model: '' });

function StatusDot({ isActive, tested }: { isActive: boolean; tested: boolean }) {
  if (!tested) return <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" title="Not tested" />;
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
      title={isActive ? 'Connected' : 'Disconnected'}
    />
  );
}

export function LlmConnect() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers', id],
    queryFn: () => api.get<LlmProvider[]>(`/pocs/${id}/llm/providers`),
    enabled: !!id,
  });

  const { data: routing } = useQuery({
    queryKey: ['routing', id],
    queryFn: () => api.get<LlmRoutingConfig>(`/pocs/${id}/llm/routing`),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['providers', id] });
    queryClient.invalidateQueries({ queryKey: ['routing', id] });
  };

  // ─── Provider form state ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyForm());
  const [formModels, setFormModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const [showRouting, setShowRouting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setFormModels([]);
    setShowAddForm(true);
  }

  function openEdit(p: LlmProvider) {
    setEditingId(p.id);
    setForm({ name: p.name, endpointUrl: p.endpointUrl, apiKey: '', model: p.model });
    setFormModels(p.availableModels ?? []);
    setShowAddForm(true);
  }

  function closeForm() {
    setShowAddForm(false);
    setEditingId(null);
    setFormModels([]);
  }

  async function handleFetchFormModels() {
    if (!form.endpointUrl) return;
    setFetchingModels(true);
    try {
      const { models } = await api.post<{ models: string[] }>(`/pocs/${id}/llm/models`, {
        endpointUrl: form.endpointUrl,
        apiKey: form.apiKey || undefined,
      });
      setFormModels(models);
      if (!form.model && models.length > 0) setForm((f) => ({ ...f, model: models[0] }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to fetch models', 'error');
    } finally {
      setFetchingModels(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: (dto: ProviderForm) =>
      api.post<LlmProvider>(`/pocs/${id}/llm/providers`, {
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey || undefined,
        model: dto.model,
      }),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to save provider', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ pid, dto }: { pid: string; dto: Partial<ProviderForm> }) =>
      api.patch<LlmProvider>(`/pocs/${id}/llm/providers/${pid}`, {
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey || undefined,
        model: dto.model,
      }),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update provider', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (pid: string) => api.delete(`/pocs/${id}/llm/providers/${pid}`),
    onSuccess: () => { setDeletingId(null); invalidate(); },
    onError: (err) => {
      setDeletingId(null);
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      if (msg.includes('CANNOT_DELETE_DEFAULT') || msg.toLowerCase().includes('designate')) {
        toast('Set another provider as default first.', 'error');
      } else {
        toast(msg, 'error');
      }
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (pid: string) => api.post<LlmProvider>(`/pocs/${id}/llm/providers/${pid}/default`, {}),
    onSuccess: () => invalidate(),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to set default', 'error'),
  });

  async function handleTestProvider(pid: string) {
    setTestingId(pid);
    try {
      const result = await api.post<{ status: string; models?: string[]; error?: string }>(
        `/pocs/${id}/llm/providers/${pid}/test`,
        {},
      );
      if (result.status === 'connected') {
        toast(`Connected — ${result.models?.length ?? 0} models available`, 'success');
      } else {
        toast(result.error ?? 'Connection failed', 'error');
      }
      invalidate();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Test failed', 'error');
    } finally {
      setTestingId(null);
    }
  }

  function handleSaveForm() {
    if (!form.name.trim() || !form.endpointUrl.trim() || !form.model.trim()) {
      toast('Name, Endpoint URL, and Model are required.', 'error');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ pid: editingId, dto: form });
    } else {
      createMutation.mutate(form);
    }
  }

  // ─── Routing mutations ────────────────────────────────────────────────────
  const setRoutingMutation = useMutation({
    mutationFn: ({ taskType, connectionId, model }: { taskType: string; connectionId: string; model: string }) =>
      api.put(`/pocs/${id}/llm/routing/${taskType}`, { connectionId, model }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing', id] }),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update routing', 'error'),
  });

  const clearRoutingMutation = useMutation({
    mutationFn: (taskType: string) => api.delete(`/pocs/${id}/llm/routing/${taskType}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing', id] }),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to clear routing', 'error'),
  });

  const activeCount = providers.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">LLM Settings</h1>
          <p className="text-sm text-muted mt-0.5">
            Connect one or more OpenAI-compatible endpoints for this POC.
          </p>
        </div>
        <Link to={`/poc/${id}`} className="text-sm text-muted hover:text-gray-300 transition-colors">
          ← Back to POC
        </Link>
      </div>

      {/* Provider list */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Providers</h2>
          {!showAddForm && (
            <button
              type="button"
              onClick={openAdd}
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              + Add provider
            </button>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-muted">Loading…</p>
        )}

        {!isLoading && providers.length === 0 && !showAddForm && (
          <div className="py-6 text-center text-sm text-muted">
            No providers configured.{' '}
            <button type="button" onClick={openAdd} className="text-accent hover:underline">
              Add one to get started.
            </button>
          </div>
        )}

        {providers.length > 0 && (
          <div className="flex flex-col divide-y divide-border">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <StatusDot isActive={p.isActive} tested={!!p.lastCheckedAt} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${p.isDefault ? 'text-white' : 'text-gray-300'}`}>
                      {p.name}
                    </span>
                    {p.isDefault && (
                      <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
                        default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">{p.endpointUrl} · {p.model}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Test */}
                  <button
                    type="button"
                    onClick={() => handleTestProvider(p.id)}
                    disabled={testingId === p.id}
                    className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-400 hover:text-white hover:border-accent/50 disabled:opacity-40 transition-colors"
                  >
                    {testingId === p.id ? (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                    ) : 'Test'}
                  </button>
                  {/* Set default */}
                  {!p.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(p.id)}
                      title="Set as default"
                      className="px-2 py-1 text-xs rounded-md border border-border text-gray-500 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
                    >
                      ☆
                    </button>
                  )}
                  {p.isDefault && (
                    <span className="px-2 py-1 text-xs text-amber-400" title="Default provider">★</span>
                  )}
                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-400 hover:text-white hover:border-accent/50 transition-colors"
                  >
                    Edit
                  </button>
                  {/* Delete */}
                  {deletingId === p.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Delete?</span>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(p.id)}
                        className="px-2 py-0.5 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-0.5 text-xs rounded border border-border text-gray-400 hover:text-white transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(p.id)}
                      className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-500 hover:text-red-400 hover:border-red-800/50 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        {showAddForm && (
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-300">
              {editingId ? 'Edit provider' : 'New provider'}
            </h3>
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. LM Studio local"
            />
            <Input
              label="Endpoint URL"
              value={form.endpointUrl}
              onChange={(e) => setForm((f) => ({ ...f, endpointUrl: e.target.value }))}
              placeholder="http://localhost:1234/v1"
            />
            <Input
              label="API key (optional)"
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-… (leave empty for local LLMs)"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-300 font-medium">Model</label>
              <div className="flex gap-2">
                <Input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. gpt-4o or paste model name"
                />
                <button
                  type="button"
                  onClick={handleFetchFormModels}
                  disabled={fetchingModels || !form.endpointUrl}
                  className="shrink-0 px-3 py-2 rounded-lg border border-border bg-surface-overlay text-sm text-gray-300 hover:border-accent/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {fetchingModels
                    ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    : '↺'}
                  Load
                </button>
              </div>
              {formModels.length > 0 && (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mt-1">
                  {formModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, model: m }))}
                      className={`w-full text-left px-3 py-1.5 rounded-lg border text-sm transition-colors
                        ${form.model === m
                          ? 'bg-accent/15 border-accent text-white font-medium'
                          : 'bg-surface-overlay border-border text-gray-300 hover:border-accent/50 hover:text-white'
                        }`}
                    >
                      {m}
                      {form.model === m && <span className="float-right text-accent text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSaveForm}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Save changes' : 'Add provider'}
              </Button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 text-sm rounded-lg border border-border text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Advanced model routing */}
      {providers.length > 0 && (
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
                const override = routing?.overrides.find((o) => o.taskType === type);
                const selectedProvider = override
                  ? providers.find((p) => p.id === override.connectionId)
                  : null;
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
                          const provider = providers.find((p) => p.id === connId);
                          const defaultModel = provider?.model ?? '';
                          setRoutingMutation.mutate({ taskType: type, connectionId: connId, model: override?.connectionId === connId ? (override?.model ?? defaultModel) : defaultModel });
                        }
                      }}
                      className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-accent/60"
                    >
                      <option value="">Default</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
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
                    {isOverrideInactive && (
                      <span title="Provider unreachable" className="text-amber-400 text-sm">⚠</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Status summary */}
      {activeCount > 0 && !showAddForm && (
        <div className="bg-green-900/10 border border-green-800/40 rounded-xl p-4">
          <p className="text-sm text-green-300 font-medium">
            ✓ {activeCount} provider{activeCount > 1 ? 's' : ''} connected
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            Ready to scaffold and run evals.{' '}
            <Link to={`/poc/${id}/evals`} className="underline hover:text-green-300">
              Run evals →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
