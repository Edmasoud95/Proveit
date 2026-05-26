import { useState } from 'react';
import type { ToolDefinition } from '@proveit/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

function isValidJson(value: string): boolean {
  if (!value.trim()) return true;
  try { JSON.parse(value); return true; } catch { return false; }
}

interface ToolsEditorProps {
  tools: ToolDefinition[];
  onSave: (tools: ToolDefinition[]) => Promise<void>;
}

export function ToolsEditor({ tools, onSave }: ToolsEditorProps) {
  const [draft, setDraft] = useState(tools);
  const [saving, setSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const hasJsonError = draft.some((t) => t.mockResponse !== undefined && !isValidJson(t.mockResponse));

  async function handleSave() {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  function updateTool(idx: number, field: keyof ToolDefinition, value: string) {
    setDraft((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        if (field === 'parameters') {
          try { return { ...t, parameters: JSON.parse(value) }; } catch { return t; }
        }
        if (field === 'mockResponse') {
          return { ...t, mockResponse: value || undefined };
        }
        return { ...t, [field]: value };
      }),
    );
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
            <div className="flex items-center gap-2">
              <span
                title={tool.mockResponse ? 'Stub configured' : 'No stub'}
                className={`w-2 h-2 rounded-full shrink-0 ${tool.mockResponse ? 'bg-green-500' : 'bg-gray-600'}`}
              />
              <span className="font-mono text-sm text-accent">{tool.name}</span>
            </div>
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
                  onChange={(e) => updateTool(idx, 'parameters', e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-surface-overlay border border-border text-gray-100 text-xs font-mono
                    focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-y"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                  Mock response
                  <span className="text-xs text-muted font-normal">— returned to agent on tool call</span>
                </label>
                <textarea
                  value={tool.mockResponse ?? ''}
                  onChange={(e) => updateTool(idx, 'mockResponse', e.target.value)}
                  placeholder='{"result": "..."}'
                  rows={4}
                  className={`w-full px-3 py-2 rounded-lg bg-surface-overlay border text-gray-100 text-xs font-mono
                    focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y
                    ${tool.mockResponse && !isValidJson(tool.mockResponse)
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-border focus:border-accent'
                    }`}
                />
                {tool.mockResponse && !isValidJson(tool.mockResponse) && (
                  <p className="text-xs text-red-400">Invalid JSON — fix before saving</p>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={addTool}>+ Add tool</Button>
        <Button size="sm" onClick={handleSave} loading={saving} disabled={hasJsonError}>Save tools</Button>
      </div>
    </div>
  );
}
