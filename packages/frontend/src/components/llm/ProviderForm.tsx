import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ProviderFormValues } from '../../hooks/useProviders';

interface ProviderFormProps {
  form: ProviderFormValues;
  setForm: React.Dispatch<React.SetStateAction<ProviderFormValues>>;
  formModels: string[];
  fetchingModels: boolean;
  editing: boolean;
  saving: boolean;
  onFetchModels: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ProviderForm({
  form,
  setForm,
  formModels,
  fetchingModels,
  editing,
  saving,
  onFetchModels,
  onSave,
  onCancel,
}: ProviderFormProps) {
  return (
    <div className="border-t border-border pt-4 flex flex-col gap-3">
      <h3 className="text-sm font-medium text-gray-300">
        {editing ? 'Edit provider' : 'New provider'}
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
            onClick={onFetchModels}
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
        <Button onClick={onSave} loading={saving}>
          {editing ? 'Save changes' : 'Add provider'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-border text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
