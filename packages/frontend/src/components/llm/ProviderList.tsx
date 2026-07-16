import { Card } from '../ui/Card';
import { ProviderCard } from './ProviderCard';
import { ProviderForm } from './ProviderForm';
import type { ProviderManager } from '../../hooks/useProviders';

interface ProviderListProps {
  manager: ProviderManager;
  /** Empty-state prefix, e.g. "No providers configured." */
  emptyText: string;
}

export function ProviderList({ manager, emptyText }: ProviderListProps) {
  const {
    providers,
    isLoading,
    editingId,
    showAddForm,
    form,
    setForm,
    formModels,
    fetchingModels,
    testingId,
    deletingId,
    setDeletingId,
    openAdd,
    openEdit,
    closeForm,
    handleFetchFormModels,
    handleTestProvider,
    handleSaveForm,
    saving,
    deleteProvider,
    setDefaultProvider,
  } = manager;

  return (
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

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      {!isLoading && providers.length === 0 && !showAddForm && (
        <div className="py-6 text-center text-sm text-muted">
          {emptyText}{' '}
          <button type="button" onClick={openAdd} className="text-accent hover:underline">
            Add one to get started.
          </button>
        </div>
      )}

      {providers.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              testing={testingId === p.id}
              confirmingDelete={deletingId === p.id}
              onTest={() => handleTestProvider(p.id)}
              onSetDefault={() => setDefaultProvider(p.id)}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProvider(p.id)}
              onRequestDelete={() => setDeletingId(p.id)}
              onCancelDelete={() => setDeletingId(null)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {showAddForm && (
        <ProviderForm
          form={form}
          setForm={setForm}
          formModels={formModels}
          fetchingModels={fetchingModels}
          editing={!!editingId}
          saving={saving}
          onFetchModels={handleFetchFormModels}
          onSave={handleSaveForm}
          onCancel={closeForm}
        />
      )}
    </Card>
  );
}
