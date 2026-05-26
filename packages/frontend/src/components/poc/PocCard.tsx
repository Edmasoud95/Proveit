import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import type { PocConfigSummary } from '@proveit/shared';

interface PocCardProps {
  poc: PocConfigSummary & { _count?: { evalCases: number; evalRuns: number } };
  onDelete?: (id: string) => void;
}

export function PocCard({ poc, onDelete }: PocCardProps) {
  const created = new Date(poc.createdAt).toLocaleDateString();

  return (
    <Card className="group hover:border-accent/40 transition-colors duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/poc/${poc.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-accent transition-colors">
            {poc.name}
          </h3>
          <p className="text-sm text-muted mt-0.5 line-clamp-2">{poc.description}</p>
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(poc.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-red-400 text-lg leading-none"
            aria-label="Delete POC"
          >
            ×
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>{poc._count?.evalCases ?? 0} eval cases</span>
        <span>·</span>
        <span>{poc._count?.evalRuns ?? 0} runs</span>
        <span>·</span>
        <span>{created}</span>
      </div>
      <div className="flex gap-2">
        <Link
          to={`/poc/${poc.id}`}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Edit config →
        </Link>
        <Link
          to={`/poc/${poc.id}/evals`}
          className="text-xs text-muted hover:text-gray-300 transition-colors"
        >
          Run evals →
        </Link>
      </div>
    </Card>
  );
}
