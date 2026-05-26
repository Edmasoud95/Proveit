import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`bg-surface-raised border border-border rounded-xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}
