import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface SystemPromptEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
}

export function SystemPromptEditor({ value, onSave }: SystemPromptEditorProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== value;

  useEffect(() => { setDraft(value); }, [value]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={14}
        className="w-full px-4 py-3 rounded-lg bg-surface-overlay border border-border text-gray-100 text-sm font-mono
          placeholder:text-gray-600 resize-y
          focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
          transition-colors duration-150"
        placeholder="System prompt…"
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving} disabled={!dirty} size="sm">
          {saved ? '✓ Saved' : 'Save'}
        </Button>
        {dirty && (
          <button
            onClick={() => setDraft(value)}
            className="text-xs text-muted hover:text-gray-300 transition-colors"
          >
            Discard changes
          </button>
        )}
        <span className="text-xs text-muted ml-auto">{draft.length} chars</span>
      </div>
    </div>
  );
}
