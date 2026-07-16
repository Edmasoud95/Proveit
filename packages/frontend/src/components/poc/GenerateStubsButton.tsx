import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenerateStubsResult, ToolDefinition } from '@proveit/shared';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Sparkle } from '../ui/Sparkle';
import { useToast } from '../ui/Toast';

interface GenerateStubsButtonProps {
  pocId: string;
  tools: ToolDefinition[];
}

function isEmpty(r?: string): boolean {
  return !r || r.trim() === '';
}

export function GenerateStubsButton({ pocId, tools }: GenerateStubsButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);

  const emptyCount = tools.filter((t) => isEmpty(t.mockResponse)).length;

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<GenerateStubsResult>(`/pocs/${pocId}/tools/stubs/generate`, { overwrite: false }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      const parts: string[] = [];
      if (result.generated.length) parts.push(`${result.generated.length} stubs generated`);
      if (result.failed.length) parts.push(`${result.failed.length} failed (${result.failed.join(', ')})`);
      toast(parts.join(', ') || 'No stubs generated', result.failed.length ? 'error' : 'success');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to generate stubs', 'error');
    },
  });

  const isLoading = generateMutation.isPending;

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => generateMutation.mutate()}
        loading={isLoading}
        disabled={isLoading || emptyCount === 0}
      >
        <Sparkle />
        {isLoading ? 'Generating…' : `Generate stubs${emptyCount > 0 ? ` (${emptyCount})` : ''}`}
      </Button>
      {isLoading && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-overlay border border-border text-xs">
          <span className="w-3 h-3 shrink-0 border border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-300">Generating mock responses…</span>
          <span className="ml-auto tabular-nums text-muted">{elapsed}s</span>
        </div>
      )}
    </div>
  );
}
