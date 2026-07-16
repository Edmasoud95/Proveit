import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PocConfig } from '@proveit/shared';
import { api } from '../services/api';
import { SystemPromptEditor } from '../components/poc/SystemPromptEditor';
import { ToolsEditor } from '../components/poc/ToolsEditor';
import { EvalCasesList } from '../components/eval/EvalCasesList';
import { EvalImport } from '../components/eval/EvalImport';
import { GenerateEvalsButton } from '../components/eval/GenerateEvalsButton';
import { Button } from '../components/ui/Button';
import { Sparkle } from '../components/ui/Sparkle';
import { ExportButton, PromptfooExportButton } from '../components/poc/ExportButton';
import { GenerateStubsButton } from '../components/poc/GenerateStubsButton';
import { ConfigVersionHistory } from '../components/poc/ConfigVersionHistory';
import { Spinner } from '../components/ui/Spinner';

type Tab = 'prompt' | 'tools' | 'evals';

export function PocEditor() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('prompt');
  const [showAddEval, setShowAddEval] = useState(false);

  const { data: poc, isLoading } = useQuery({
    queryKey: ['poc', id],
    queryFn: () => api.get<PocConfig>(`/pocs/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PocConfig>) => api.patch<PocConfig>(`/pocs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poc', id] });
      queryClient.invalidateQueries({ queryKey: ['config-versions', id] });
    },
  });

  const importCasesMutation = useMutation({
    mutationFn: (cases: unknown[]) =>
      api.post(`/pocs/${id}/evals`, { cases }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['poc', id] }),
  });

  const generateCasesMutation = useMutation({
    mutationFn: (count: number) => api.post(`/pocs/${id}/evals/generate`, { count }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['poc', id] }),
  });

  const generateToolDataMutation = useMutation({
    mutationFn: () => api.post(`/pocs/${id}/evals/generate`, { count: 5, toolFocused: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['poc', id] }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!poc) return <p className="text-muted">POC not found.</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'prompt', label: 'System prompt' },
    { key: 'tools', label: `Tools (${poc.tools.length})` },
    { key: 'evals', label: `Eval cases (${poc.evalCases.length})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{poc.name}</h1>
          <p className="text-sm text-muted mt-0.5 line-clamp-1">{poc.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PromptfooExportButton pocId={poc.id} />
          <ExportButton pocId={poc.id} />
          <Link
            to={`/poc/${poc.id}/llm`}
            className="px-3 py-1.5 text-sm rounded-lg bg-surface-overlay border border-border text-gray-200
              hover:bg-surface-raised transition-colors"
          >
            LLM settings
          </Link>
          <Link
            to={`/poc/${poc.id}/chat`}
            className="px-3 py-1.5 text-sm rounded-lg bg-surface-overlay border border-border text-gray-200
              hover:bg-surface-raised transition-colors"
          >
            Chat
          </Link>
          <Link
            to={`/poc/${poc.id}/evals`}
            className="px-3 py-1.5 text-sm rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            Run evals →
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px
              ${tab === t.key
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-gray-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {tab === 'prompt' && (
          <SystemPromptEditor
            value={poc.systemPrompt}
            onSave={async (systemPrompt) => { await updateMutation.mutateAsync({ systemPrompt }); }}
          />
        )}
        {tab === 'tools' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <GenerateStubsButton pocId={poc.id} tools={poc.tools} />
            </div>
            <ToolsEditor
              pocId={poc.id}
              tools={poc.tools}
              onSave={async (tools) => { await updateMutation.mutateAsync({ tools }); }}
            />
          </div>
        )}
        {tab === 'evals' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
              <EvalImport onImport={async (cases) => { await importCasesMutation.mutateAsync(cases as never[]); }} />
              <GenerateEvalsButton
                onGenerate={async (count) => { await generateCasesMutation.mutateAsync(count); }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => generateToolDataMutation.mutate()}
                loading={generateToolDataMutation.isPending}
              >
                <Sparkle /> Generate test data
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddEval(true)}
              >
                + Add manually
              </Button>
            </div>
            <EvalCasesList
              pocId={poc.id}
              cases={poc.evalCases}
              addingNew={showAddEval}
              onAddComplete={() => setShowAddEval(false)}
            />
          </div>
        )}

        <ConfigVersionHistory
          pocId={poc.id}
          onRestore={() => {
            queryClient.invalidateQueries({ queryKey: ['poc', id] });
            queryClient.invalidateQueries({ queryKey: ['config-versions', id] });
          }}
        />
      </div>
    </div>
  );
}
