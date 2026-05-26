import { useRef, useState } from 'react';
import { Button } from '../ui/Button';

interface ImportedCase {
  name: string;
  input: unknown;
  judgeCriteria: string;
}

interface EvalImportProps {
  onImport: (cases: ImportedCase[]) => Promise<void>;
}

export function EvalImport({ onImport }: EvalImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const cases: ImportedCase[] = Array.isArray(parsed) ? parsed : parsed.cases;

      if (!Array.isArray(cases)) throw new Error('JSON must be an array of eval cases');

      for (const c of cases) {
        if (!c.name || !c.input || !c.judgeCriteria) {
          throw new Error('Each case must have "name", "input", and "judgeCriteria"');
        }
      }

      setLoading(true);
      await onImport(cases);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON file');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleFile}
        className="hidden"
        id="eval-import"
      />
      <Button
        variant="secondary"
        size="sm"
        loading={loading}
        onClick={() => inputRef.current?.click()}
      >
        Import JSON
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
