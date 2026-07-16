import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';

interface ExportMenuProps {
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

const EXPORT_ITEMS = [
  { label: 'Plan for coding agent', path: (id: string) => `/api/pocs/${id}/export/plan`, fallback: 'plan.md' },
  {
    label: 'Promptfoo config',
    path: (id: string) => `/api/pocs/${id}/evals/export/promptfoo`,
    fallback: 'promptfooconfig.yaml',
  },
  { label: 'Raw JSON', path: (id: string) => `/api/pocs/${id}/export`, fallback: 'poc.json' },
];

export function ExportMenu({ pocId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleSelect(item: (typeof EXPORT_ITEMS)[number]) {
    setOpen(false);
    setLoading(true);
    try {
      await downloadFromApi(item.path(pocId), item.fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} loading={loading}>
        Export ▾
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[13rem] rounded-lg border border-border
            bg-surface-overlay shadow-lg py-1"
        >
          {EXPORT_ITEMS.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => handleSelect(item)}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-surface-raised
                transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
