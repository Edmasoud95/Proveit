import { useState } from 'react';
import { Button } from '../ui/Button';

interface ExportButtonProps {
  pocId: string;
}

export function ExportButton({ pocId }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pocs/${pocId}/export`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="(.+)"/)?.[1] ?? 'poc.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} loading={loading}>
      Export JSON
    </Button>
  );
}
