import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Sparkle } from '../ui/Sparkle';
import { useToast } from '../ui/Toast';

interface GenerateStubsButtonProps {
  pocId: string;
}

interface GenerateStubsResult {
  generated: string[];
  skipped: string[];
  failed: string[];
}

export function GenerateStubsButton({ pocId }: GenerateStubsButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);

  const generateMutation = useMutation({
    mutationFn: (overwrite: boolean) =>
      api.post<GenerateStubsResult>(`/pocs/${pocId}/tools/stubs/generate`, { overwrite }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
      const parts: string[] = [];
      if (result.generated.length) parts.push(`${result.generated.length} stubs generated`);
      if (result.failed.length) parts.push(`${result.failed.length} failed (${result.failed.join(', ')})`);
      toast(parts.join(', ') || 'No stubs generated', result.failed.length ? 'error' : 'success');
      setConfirming(false);
    },
  });

  async function handleClick() {
    setChecking(true);
    try {
      const result = await api.post<GenerateStubsResult>(`/pocs/${pocId}/tools/stubs/generate`, { overwrite: false });
      if (result.skipped.length > 0) {
        setConfirming(true);
      } else {
        queryClient.invalidateQueries({ queryKey: ['poc', pocId] });
        const parts: string[] = [];
        if (result.generated.length) parts.push(`${result.generated.length} stubs generated`);
        if (result.failed.length) parts.push(`${result.failed.length} failed (${result.failed.join(', ')})`);
        toast(parts.join(', ') || 'No stubs generated', result.failed.length ? 'error' : 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate stubs', 'error');
    } finally {
      setChecking(false);
    }
  }

  const isLoading = checking || generateMutation.isPending;
  const buttonLabel = checking
    ? 'Checking stubs…'
    : generateMutation.isPending
    ? 'Generating…'
    : 'Generate stubs';

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Some tools already have stubs. Regenerate all?</span>
          <button
            onClick={() => generateMutation.mutate(true)}
            disabled={generateMutation.isPending}
            className="px-2 py-1 text-xs rounded bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {generateMutation.isPending && (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            )}
            {generateMutation.isPending ? 'Generating…' : 'Yes, regenerate'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={generateMutation.isPending}
            className="px-2 py-1 text-xs rounded bg-surface-overlay border border-border text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      loading={isLoading}
      disabled={isLoading}
    >
      <Sparkle /> {buttonLabel}
    </Button>
  );
}
