import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-overlay text-gray-400 border-border',
  success: 'bg-green-900/30 text-green-400 border-green-800',
  error: 'bg-red-900/30 text-red-400 border-red-800',
  warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  info: 'bg-blue-900/30 text-blue-400 border-blue-800',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
