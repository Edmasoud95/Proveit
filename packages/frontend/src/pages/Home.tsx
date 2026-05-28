import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PocConfigSummary } from '@proveit/shared';
import { api } from '../services/api';
import { PocCard } from '../components/poc/PocCard';
import { CreatePocForm } from '../components/poc/CreatePocForm';
import { PocCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface CreatePocPayload {
  description: string;
  endpointUrl?: string;
  apiKey?: string;
  model?: string;
  globalProviderId?: string;
}

export function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const { data: pocs, isLoading } = useQuery({
    queryKey: ['pocs'],
    queryFn: () => api.get<Array<PocConfigSummary & { _count: { evalCases: number; evalRuns: number } }>>('/pocs'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pocs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pocs'] }),
  });

  async function handleCreate(data: CreatePocPayload) {
    setCreating(true);
    try {
      const poc = await api.post<PocConfigSummary>('/pocs/scaffold', data);
      queryClient.invalidateQueries({ queryKey: ['pocs'] });
      navigate(`/poc/${poc.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Scaffolding failed', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Proveit</h1>
        <p className="text-muted text-sm">Scaffold, run, and evaluate agent workflow POCs in minutes.</p>
      </div>

      <section className="bg-surface-raised border border-border rounded-xl p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">New POC</h2>
        <CreatePocForm onSubmit={handleCreate} loading={creating} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Your POCs</h2>
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((n) => <PocCardSkeleton key={n} />)}
          </div>
        ) : !pocs?.length ? (
          <EmptyState
            title="No POCs yet"
            description="Describe a workflow above to scaffold your first POC."
          />
        ) : (
          <div className="grid gap-3">
            {pocs.map((poc) => (
              <PocCard
                key={poc.id}
                poc={poc}
                onDelete={(id) => {
                  if (confirm('Delete this POC?')) deleteMutation.mutate(id);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
