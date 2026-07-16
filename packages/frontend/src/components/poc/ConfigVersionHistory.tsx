import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PocConfigVersionSummary, PocConfigVersion, ToolDefinition } from '@proveit/shared';
import { api } from '../../services/api';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { lineDiff, toolsDiff } from './configVersionDiff';

interface ConfigVersionHistoryProps {
  pocId: string;
  onRestore: () => void;
}

export function ConfigVersionHistory({ pocId, onRestore }: ConfigVersionHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [diffSelection, setDiffSelection] = useState<[string, string] | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['config-versions', pocId],
    queryFn: () => api.get<PocConfigVersionSummary[]>(`/pocs/${pocId}/config-versions`),
    enabled: open,
  });

  const { data: diffA } = useQuery({
    queryKey: ['config-version', pocId, diffSelection?.[0]],
    queryFn: () => api.get<PocConfigVersion>(`/pocs/${pocId}/config-versions/${diffSelection![0]}`),
    enabled: !!diffSelection?.[0],
  });

  const { data: diffB } = useQuery({
    queryKey: ['config-version', pocId, diffSelection?.[1]],
    queryFn: () => api.get<PocConfigVersion>(`/pocs/${pocId}/config-versions/${diffSelection![1]}`),
    enabled: !!diffSelection?.[1],
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) =>
      api.post(`/pocs/${pocId}/config-versions/${versionId}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-versions', pocId] });
      setConfirmRestoreId(null);
      setDiffSelection(null);
      onRestore();
      toast('Config restored successfully', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Restore failed', 'error'),
  });

  function toggleDiffSelection(versionId: string) {
    setDiffSelection((prev) => {
      if (!prev) return [versionId, ''];
      if (prev[0] === versionId) return null;
      if (prev[1] === versionId) return [prev[0], ''];
      if (!prev[1]) return [prev[0], versionId];
      return [versionId, ''];
    });
  }

  const hasDiff = diffSelection?.[0] && diffSelection?.[1] && diffA && diffB;
  const promptDiff = hasDiff ? lineDiff(diffA.systemPrompt, diffB.systemPrompt) : null;
  const tDiff = hasDiff
    ? toolsDiff(
        JSON.parse(diffA.tools) as ToolDefinition[],
        JSON.parse(diffB.tools) as ToolDefinition[],
      )
    : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted hover:text-gray-300 transition-colors self-start"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>Version history</span>
        {versions.length > 0 && (
          <span className="font-mono text-blue-400/80 bg-blue-900/20 border border-blue-700/30 rounded px-1.5 py-0.5">
            {versions[0]?.versionNumber != null ? `v${versions[0].versionNumber}` : ''}
          </span>
        )}
      </button>

      {open && (
        <Card className="flex flex-col gap-4">
          {isLoading && <p className="text-sm text-muted">Loading…</p>}

          {!isLoading && versions.length === 0 && (
            <p className="text-sm text-muted">No versions yet. Save the system prompt or tools to create one.</p>
          )}

          {versions.length > 0 && (
            <>
              <p className="text-xs text-muted">
                Select two versions to diff them. Click Restore to revert the POC to any version.
              </p>

              <div className="flex flex-col divide-y divide-border">
                {versions.map((v) => {
                  const isSelected = diffSelection?.includes(v.id);
                  const selIdx = diffSelection ? diffSelection.indexOf(v.id) : -1;

                  return (
                    <div key={v.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => toggleDiffSelection(v.id)}
                        className={`w-5 h-5 rounded border text-xs font-mono shrink-0 transition-colors
                          ${isSelected
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                            : 'border-border text-muted hover:border-accent/50'
                          }`}
                      >
                        {selIdx >= 0 ? selIdx + 1 : ''}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-300">v{v.versionNumber}</span>
                          <span className="text-xs text-gray-300">{v.changeLabel}</span>
                        </div>
                        <p className="text-xs text-muted">{new Date(v.createdAt).toLocaleString()}</p>
                      </div>
                      {confirmRestoreId === v.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">Restore v{v.versionNumber}?</span>
                          <button
                            type="button"
                            onClick={() => restoreMutation.mutate(v.id)}
                            disabled={restoreMutation.isPending}
                            className="px-2 py-0.5 text-xs rounded border border-amber-700 text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRestoreId(null)}
                            className="px-2 py-0.5 text-xs rounded border border-border text-muted hover:text-white transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreId(v.id)}
                          className="px-2 py-1 text-xs rounded border border-border text-muted hover:text-amber-400 hover:border-amber-700/50 transition-colors shrink-0"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Diff view */}
              {diffSelection?.[0] && diffSelection?.[1] && (
                <div className="border-t border-border pt-4 flex flex-col gap-4">
                  {(!diffA || !diffB) && <p className="text-xs text-muted">Loading diff…</p>}

                  {promptDiff && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-2">System prompt diff</p>
                      {promptDiff.every((l) => l.type === 'unchanged') ? (
                        <p className="text-xs text-muted italic">No changes to system prompt</p>
                      ) : (
                        <div className="rounded-lg overflow-hidden border border-border text-xs font-mono max-h-64 overflow-y-auto">
                          {promptDiff.map((line, i) => (
                            <div
                              key={i}
                              className={`px-3 py-0.5 whitespace-pre-wrap ${
                                line.type === 'added'
                                  ? 'bg-green-900/30 text-green-300'
                                  : line.type === 'removed'
                                  ? 'bg-red-900/30 text-red-300'
                                  : 'text-gray-400'
                              }`}
                            >
                              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} {line.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tDiff && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wide mb-2">Tools diff</p>
                      {tDiff.added.length === 0 && tDiff.removed.length === 0 && tDiff.modified.length === 0 ? (
                        <p className="text-xs text-muted italic">No changes to tools</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {tDiff.added.map((t) => (
                            <div key={t.name} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-green-900/20 border border-green-800/40">
                              <span className="text-green-400 font-mono">+</span>
                              <span className="font-mono text-green-300">{t.name}</span>
                              <span className="text-green-500 ml-auto">added</span>
                            </div>
                          ))}
                          {tDiff.removed.map((t) => (
                            <div key={t.name} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-red-900/20 border border-red-800/40">
                              <span className="text-red-400 font-mono">-</span>
                              <span className="font-mono text-red-300">{t.name}</span>
                              <span className="text-red-500 ml-auto">removed</span>
                            </div>
                          ))}
                          {tDiff.modified.map((t) => (
                            <div key={t.name} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-amber-900/20 border border-amber-800/40">
                              <span className="text-amber-400 font-mono">~</span>
                              <span className="font-mono text-amber-300">{t.name}</span>
                              <span className="text-amber-500 ml-auto">modified</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
