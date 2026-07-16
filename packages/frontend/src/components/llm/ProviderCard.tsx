import type { LlmProvider } from '@proveit/shared';

export function StatusDot({ isActive, tested }: { isActive: boolean; tested: boolean }) {
  if (!tested) return <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" title="Not tested" />;
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
      title={isActive ? 'Connected' : 'Disconnected'}
    />
  );
}

interface ProviderCardProps {
  provider: LlmProvider;
  testing: boolean;
  confirmingDelete: boolean;
  onTest: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
}

export function ProviderCard({
  provider: p,
  testing,
  confirmingDelete,
  onTest,
  onSetDefault,
  onEdit,
  onDelete,
  onRequestDelete,
  onCancelDelete,
}: ProviderCardProps) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
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
          onClick={onTest}
          disabled={testing}
          className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-400 hover:text-white hover:border-accent/50 disabled:opacity-40 transition-colors"
        >
          {testing ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
          ) : 'Test'}
        </button>
        {/* Set default */}
        {!p.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
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
          onClick={onEdit}
          className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-400 hover:text-white hover:border-accent/50 transition-colors"
        >
          Edit
        </button>
        {/* Delete */}
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Delete?</span>
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-0.5 text-xs rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="px-2 py-0.5 text-xs rounded border border-border text-gray-400 hover:text-white transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequestDelete}
            className="px-2.5 py-1 text-xs rounded-md border border-border text-gray-500 hover:text-red-400 hover:border-red-800/50 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
