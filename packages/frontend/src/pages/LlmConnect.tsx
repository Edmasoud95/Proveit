import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { LlmConnection, LlmConnectionTestResult } from '@proveit/shared';
import { api } from '../services/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ConnectionStatus } from '../components/llm/ConnectionStatus';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';

export function LlmConnect() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: connection, refetch } = useQuery({
    queryKey: ['llm', id],
    queryFn: () => api.get<LlmConnection | null>(`/pocs/${id}/llm`),
    enabled: !!id,
  });

  const [endpointUrl, setEndpointUrl] = useState('http://localhost:1234/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [testResult, setTestResult] = useState<LlmConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (connection) {
      setEndpointUrl(connection.endpointUrl);
      setModel(connection.model);
    }
  }, [connection]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/pocs/${id}/llm`, {
        endpointUrl,
        model,
        apiKey: apiKey || undefined,
      }),
    onSuccess: () => refetch(),
  });

  async function handleTest() {
    setTesting(true);
    try {
      await saveMutation.mutateAsync();
      const result = await api.post<LlmConnectionTestResult>(`/pocs/${id}/llm/test`, {});
      setTestResult(result);
      if (result.models) {
        setModels(result.models);
        if (!model && result.models.length > 0) setModel(result.models[0]);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleFetchModels() {
    setFetchingModels(true);
    try {
      const { models: fetched } = await api.post<{ models: string[] }>(`/pocs/${id}/llm/models`, {
        endpointUrl,
        apiKey: apiKey || undefined,
      });
      setModels(fetched);
      if (fetched.length === 0) {
        toast('No models found at this endpoint', 'info');
      } else if (!model && fetched.length > 0) {
        setModel(fetched[0]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to fetch models', 'error');
    } finally {
      setFetchingModels(false);
    }
  }

  const connectionStatus = testing
    ? 'testing'
    : testResult?.status === 'connected'
    ? 'connected'
    : 'disconnected';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">LLM Connection</h1>
          <p className="text-sm text-muted mt-0.5">
            Connect a local or external OpenAI-compatible endpoint.
          </p>
        </div>
        <Link
          to={`/poc/${id}`}
          className="text-sm text-muted hover:text-gray-300 transition-colors"
        >
          ← Back to POC
        </Link>
      </div>

      <Card className="flex flex-col gap-4">
        <Input
          label="Endpoint URL"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder="http://localhost:1234/v1"
        />
        <Input
          label="API key (optional)"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-… (leave empty for local LLMs)"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-300 font-medium">Model</label>
          <div className="flex gap-2">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. gpt-4o or paste model name"
            />
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={fetchingModels || !endpointUrl}
              className="shrink-0 px-3 py-2 rounded-lg border border-border bg-surface-overlay text-sm text-gray-300 hover:border-accent/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {fetchingModels
                ? <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                : '↺'}
              Load
            </button>
          </div>
          {models.length > 0 && (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModel(m)}
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

        <div className="flex items-center gap-4">
          <Button onClick={handleTest} loading={testing}>
            Test connection
          </Button>
          <ConnectionStatus
            status={connectionStatus}
            model={connection?.model}
            latencyMs={testResult?.status === 'connected' ? testResult.latencyMs : undefined}
          />
        </div>

        {testResult?.status === 'failed' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            <p className="text-sm text-red-300">{testResult.error}</p>
            <ul className="mt-2 text-xs text-red-400 list-disc list-inside">
              <li>LM Studio: Enable local server mode in app settings</li>
              <li>Ollama: Run <code>ollama serve</code> in terminal</li>
              <li>External: Check API key is valid and endpoint URL is correct</li>
            </ul>
          </div>
        )}
      </Card>

      {connection?.isActive && (
        <div className="bg-green-900/10 border border-green-800/40 rounded-xl p-4">
          <p className="text-sm text-green-300 font-medium">✓ LLM connected</p>
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
