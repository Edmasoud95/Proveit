import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { LlmProvider } from '@proveit/shared';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';

export type ProviderFormValues = { name: string; endpointUrl: string; apiKey: string; model: string };
export const emptyProviderForm = (): ProviderFormValues => ({
  name: '',
  endpointUrl: 'http://localhost:1234/v1',
  apiKey: '',
  model: '',
});

interface UseProvidersOptions {
  /** Base path for provider CRUD, e.g. `/llm/global-providers` or `/pocs/:id/llm/providers` */
  basePath: string;
  /** Path for the model-listing endpoint, e.g. `/llm/models` or `/pocs/:id/llm/models` */
  modelsPath: string;
  /** Query key for the provider list — must stay stable, other components invalidate it */
  queryKey: QueryKey;
  /** Additional query keys to invalidate when providers change (e.g. routing) */
  extraInvalidateKeys?: QueryKey[];
  enabled?: boolean;
}

export function useProviders({
  basePath,
  modelsPath,
  queryKey,
  extraInvalidateKeys = [],
  enabled = true,
}: UseProvidersOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get<LlmProvider[]>(basePath),
    enabled,
  });

  const invalidate = () => {
    [queryKey, ...extraInvalidateKeys].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: key }),
    );
  };

  // ─── Provider form state ──────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ProviderFormValues>(emptyProviderForm());
  const [formModels, setFormModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyProviderForm());
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
      const { models } = await api.post<{ models: string[] }>(modelsPath, {
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
    mutationFn: (dto: ProviderFormValues) =>
      api.post<LlmProvider>(basePath, {
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey || undefined,
        model: dto.model,
      }),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to save provider', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ pid, dto }: { pid: string; dto: Partial<ProviderFormValues> }) =>
      api.patch<LlmProvider>(`${basePath}/${pid}`, {
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey || undefined,
        model: dto.model,
      }),
    onSuccess: () => { invalidate(); closeForm(); },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to update provider', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (pid: string) => api.delete(`${basePath}/${pid}`),
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
    mutationFn: (pid: string) => api.post<LlmProvider>(`${basePath}/${pid}/default`, {}),
    onSuccess: () => invalidate(),
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to set default', 'error'),
  });

  async function handleTestProvider(pid: string) {
    setTestingId(pid);
    try {
      const result = await api.post<{ status: string; models?: string[]; error?: string }>(
        `${basePath}/${pid}/test`,
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

  return {
    providers,
    isLoading,
    // form state
    editingId,
    showAddForm,
    form,
    setForm,
    formModels,
    fetchingModels,
    testingId,
    deletingId,
    setDeletingId,
    // actions
    openAdd,
    openEdit,
    closeForm,
    handleFetchFormModels,
    handleTestProvider,
    handleSaveForm,
    saving: createMutation.isPending || updateMutation.isPending,
    deleteProvider: deleteMutation.mutate,
    setDefaultProvider: setDefaultMutation.mutate,
  };
}

export type ProviderManager = ReturnType<typeof useProviders>;
