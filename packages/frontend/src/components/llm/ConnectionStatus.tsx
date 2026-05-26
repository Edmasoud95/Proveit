type Status = 'connected' | 'disconnected' | 'testing';

interface ConnectionStatusProps {
  status: Status;
  model?: string;
  latencyMs?: number;
}

const indicators: Record<Status, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-400', label: 'Connected' },
  disconnected: { dot: 'bg-gray-500', label: 'Not connected' },
  testing: { dot: 'bg-yellow-400 animate-pulse', label: 'Testing…' },
};

export function ConnectionStatus({ status, model, latencyMs }: ConnectionStatusProps) {
  const { dot, label } = indicators[status];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-gray-300">{label}</span>
      {model && <span className="text-muted">· {model}</span>}
      {latencyMs !== undefined && (
        <span className="text-muted">· {latencyMs}ms</span>
      )}
    </div>
  );
}
