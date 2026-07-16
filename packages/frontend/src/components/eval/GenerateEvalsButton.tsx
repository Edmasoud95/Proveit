import { useState } from 'react';
import { Button } from '../ui/Button';
import { Sparkle } from '../ui/Sparkle';

interface GenerateEvalsButtonProps {
  onGenerate: (count: number) => Promise<void>;
}

export function GenerateEvalsButton({ onGenerate }: GenerateEvalsButtonProps) {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try { await onGenerate(count); } finally { setLoading(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleGenerate} loading={loading}>
        <Sparkle /> Generate cases
      </Button>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted">Count:</span>
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-14 px-2 py-1 text-xs rounded-md bg-surface-overlay border border-border text-gray-100
            focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
    </div>
  );
}
