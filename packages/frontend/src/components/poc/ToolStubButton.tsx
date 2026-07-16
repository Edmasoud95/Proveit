import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenerateStubsResult, ToolDefinition } from '@proveit/shared';
import { api } from '../../services/api';
import { Sparkle } from '../ui/Sparkle';
import { useToast } from '../ui/Toast';

interface ToolStubButtonProps {
  pocId: string;
  tool: ToolDefinition;
}

export function ToolStubButton({ pocId, tool }: ToolStubButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.post<GenerateStubsResult>(`/pocs/${pocId}/tools/stubs/generate`, {
        overwrite: true,
        toolNames: [tool.name],
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      if (result.generated.includes(tool.name)) {
        toast(`Stub generated for ${tool.name}`, 'success');
      } else if (result.failed.includes(tool.name)) {
        toast(`Failed to generate stub for ${tool.name}`, 'error');
      }
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to generate stub', 'error');
    },
  });

  return (
    <button
      onClick={(e) => { e.stopPropagation(); mutation.mutate(); }}
      disabled={mutation.isPending}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-surface-overlay border border-border text-muted
        hover:text-gray-300 hover:border-accent/50 transition-colors disabled:opacity-50"
      title={tool.mockResponse ? 'Regenerate the mock response for this tool (overwrites it)' : 'Generate a mock response for this tool'}
    >
      {mutation.isPending ? (
        <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Sparkle />
      )}
      {mutation.isPending ? 'Generating…' : tool.mockResponse ? 'Regenerate stub' : 'Generate stub'}
    </button>
  );
}
