interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      className={`inline-block border-2 border-accent/30 border-t-accent rounded-full animate-spin ${sizes[size]} ${className}`}
    />
  );
}
