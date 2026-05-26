import { useState } from 'react';
import type { ToolDefinition } from '@proveit/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

interface ToolsEditorProps {
  tools: ToolDefinition[];
  onSave: (tools: ToolDefinition[]) => Promise<void>;
}

export function ToolsEditor({ tools, onSave }: ToolsEditorProps) {
  const [draft, setDraft] = useState(tools);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  async function handleSave() {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  function updateTool(idx: number, field: keyof ToolDefinition, value: string) {
    setDraft((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }

  function addTool() {
    const newTool: ToolDefinition = {
      name: 'new_tool',
      description: '',
      parameters: { type: 'object', properties: {}, required: [] },
    };
    setDraft((prev) => [...prev, newTool]);
    setExpandedIdx(draft.length);
  }

  function removeTool(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-4">
      {draft.length === 0 && (
        <p className="text-sm text-muted text-center py-6">No tools defined. Add one below.</p>
      )}
      {draft.map((tool, idx) => (
        <Card key={idx} className="flex flex-col gap-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <span className="font-mono text-sm text-accent">{tool.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); removeTool(idx); }}
                className="text-muted hover:text-red-400 transition-colors text-xs"
              >
                Remove
              </button>
              <span className="text-muted text-xs">{expandedIdx === idx ? '▾' : '▸'}</span>
            </div>
          </div>
          {expandedIdx === idx && (
            <div className="flex flex-col gap-3 pt-2 border-t border-border">
              <Input
                label="Tool name (snake_case)"
                value={tool.name}
                onChange={(e) => updateTool(idx, 'name', e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-300 font-medium">Description</label>
                <textarea
                  value={tool.description}
                  onChange={(e) => updateTool(idx, 'description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border text-gray-100 text-sm
                    focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-300 font-medium">Parameters (JSON schema)</label>
                <textarea
                  value={JSON.stringify(tool.parameters, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateTool(idx, 'parameters', parsed);
                    } catch { /* ignore invalid JSON while typing */ }
                  }}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border text-gray-100 text-xs font-mono
                    focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-y"
                />
              </div>
            </div>
          )}
        </Card>
      ))}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={addTool}>+ Add tool</Button>
        <Button size="sm" onClick={handleSave} loading={saving}>Save tools</Button>
      </div>
    </div>
  );
}
