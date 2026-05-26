import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Sparkle } from '../ui/Sparkle';
import { useToast } from '../ui/Toast';
import { api } from '../../services/api';

interface CreatePocFormProps {
  onSubmit: (data: { description: string; endpointUrl: string; apiKey?: string; model?: string }) => Promise<void>;
  loading?: boolean;
}

export function CreatePocForm({ onSubmit, loading }: CreatePocFormProps) {
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('http://localhost:1234/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const { toast } = useToast();

  async function handleLoadModels() {
    setLoadingModels(true);
    try {
      const { models: fetched } = await api.post<{ models: string[] }>('/llm/models', {
        endpointUrl,
        apiKey: apiKey || undefined,
      });
      setModels(fetched);
      if (fetched.length === 0) toast('No models found at this endpoint', 'info');
      else if (!model) setModel(fetched[0]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to fetch models', 'error');
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 10) return;
    await onSubmit({
      description: description.trim(),
      endpointUrl,
      apiKey: apiKey || undefined,
      model: model || undefined,
    });
    setDescription('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-gray-300 font-medium">Workflow description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your agent workflow… e.g. 'A customer support agent that answers questions using a knowledge base and escalates complex issues to a human'"
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg bg-surface-overlay border border-border text-gray-100 text-sm
            placeholder:text-gray-600 resize-none
            focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
            transition-colors duration-150"
          disabled={loading}
        />
        <p className="text-xs text-muted">{description.length} chars · minimum 10</p>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          label="LLM endpoint URL"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder="http://localhost:1234/v1"
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted hover:text-gray-300 text-left transition-colors"
        >
          {showAdvanced ? '▾' : '▸'} Advanced options
        </button>
        {showAdvanced && (
          <div className="flex flex-col gap-3 pl-3 border-l border-border">
            <Input
              label="API key (optional)"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-… (leave empty for local LLMs)"
              disabled={loading}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-300 font-medium">Model (optional)</label>
              <div className="flex gap-2">
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o, llama-3-8b, …"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleLoadModels}
                  disabled={loadingModels || !endpointUrl || loading}
                  className="shrink-0 px-3 py-2 rounded-lg border border-border bg-surface-overlay text-sm text-gray-300 hover:border-accent/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {loadingModels
                    ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    : '↺'}
                  Load
                </button>
              </div>
              {models.length > 0 && (
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setModel(m); setModels([]); }}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors
                        ${model === m
                          ? 'bg-accent/15 border-accent text-white font-medium'
                          : 'bg-surface-overlay border-border text-gray-300 hover:border-accent/50 hover:text-white'
                        }`}
                    >
                      {m}
                      {model === m && <span className="float-right text-accent text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Button type="submit" loading={loading} disabled={description.trim().length < 10}>
        <Sparkle /> {loading ? 'Scaffolding…' : 'Scaffold POC'}
      </Button>
    </form>
  );
}
