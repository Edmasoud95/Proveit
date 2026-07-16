import { useState } from 'react';
import { Button } from '../ui/Button';

interface ExportButtonProps {
  pocId: string;
}

async function downloadFromApi(path: string, fallbackName: string) {
  const res = await fetch(path);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="(.+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DownloadButton({ path, fallbackName, label }: { path: string; fallbackName: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      await downloadFromApi(path, fallbackName);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport} loading={loading}>
      {label}
    </Button>
  );
}

export function ExportButton({ pocId }: ExportButtonProps) {
  return <DownloadButton path={`/api/pocs/${pocId}/export`} fallbackName="poc.json" label="Export JSON" />;
}

/** Exports the eval suite as a runnable promptfooconfig.yaml (see README "Graduating to CI"). */
export function PromptfooExportButton({ pocId }: ExportButtonProps) {
  return (
    <DownloadButton
      path={`/api/pocs/${pocId}/evals/export/promptfoo`}
      fallbackName="promptfooconfig.yaml"
      label="Export for Promptfoo"
    />
  );
}
