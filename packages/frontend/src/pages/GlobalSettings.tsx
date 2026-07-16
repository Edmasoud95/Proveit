import { Link } from 'react-router-dom';
import { ProviderList } from '../components/llm/ProviderList';
import { useProviders } from '../hooks/useProviders';

export function GlobalSettings() {
  const manager = useProviders({
    basePath: '/llm/global-providers',
    modelsPath: '/llm/models',
    queryKey: ['global-providers'],
  });

  const { providers, showAddForm } = manager;
  const activeCount = providers.filter((p) => p.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Global LLM Providers</h1>
          <p className="text-sm text-muted mt-0.5">
            Providers configured here are available as fallbacks for all POCs.
          </p>
        </div>
        <Link to="/" className="text-sm text-muted hover:text-gray-300 transition-colors">
          ← Back
        </Link>
      </div>

      {/* Provider list */}
      <ProviderList manager={manager} emptyText="No global providers configured." />

      {activeCount > 0 && !showAddForm && (
        <div className="bg-green-900/10 border border-green-800/40 rounded-xl p-4">
          <p className="text-sm text-green-300 font-medium">
            ✓ {activeCount} provider{activeCount > 1 ? 's' : ''} connected
          </p>
          <p className="text-xs text-green-500 mt-0.5">
            These providers are available as fallbacks in all POCs.
          </p>
        </div>
      )}
    </div>
  );
}
