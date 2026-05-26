interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-lg bg-surface-overlay ${className}`} />
  );
}

export function PocCardSkeleton() {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
