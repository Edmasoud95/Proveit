import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { StatusDot } from '../components/llm/ProviderCard';
import { ProviderList } from '../components/llm/ProviderList';
import { ModelRoutingPanel } from '../components/llm/ModelRoutingPanel';
import { useProviders } from '../hooks/useProviders';
import { useRouting } from '../hooks/useRouting';

export function LlmConnect() {
  const { id } = useParams<{ id: string }>();

  const manager = useProviders({
    basePath: `/pocs/${id}/llm/providers`,
    modelsPath: `/pocs/${id}/llm/models`,
    queryKey: ['providers', id],
    extraInvalidateKeys: [['routing', id]],
    enabled: !!id,
  });

  const { data: routing } = useRouting(id);

  const { providers, showAddForm } = manager;
  const activeCount = providers.filter((p) => p.isActive).length;
  const globalProviders = (routing?.providers ?? []).filter((p) => p.isGlobal);

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
      <ProviderList manager={manager} emptyText="No providers configured." />

      {/* Global providers (read-only) */}
      {globalProviders.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Global providers</h2>
            <Link to="/settings" className="text-xs text-accent hover:text-accent/80 transition-colors">
              Manage in Settings →
            </Link>
          </div>
          <p className="text-xs text-muted -mt-1">
            Available as fallbacks for all POCs. Used when no POC-specific default is configured.
          </p>
          <div className="flex flex-col divide-y divide-border">
            {globalProviders.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <StatusDot isActive={p.isActive} tested={!!p.lastCheckedAt} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300">{p.name}</span>
                    {p.isDefault && (
                      <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
                        global default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">{p.endpointUrl} · {p.model}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Advanced model routing */}
      {(routing?.providers ?? []).length > 0 && id && (
        <ModelRoutingPanel pocId={id} routing={routing} />
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
