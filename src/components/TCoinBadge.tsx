import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TCoinBadgeProps {
  amount: number;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function TCoinBadge({ amount, className, showIcon = true, size = 'md' }: TCoinBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  return (
    <div className={cn('tcoin-badge', sizeClasses[size], className)}>
      {showIcon && <Coins className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4')} />}
      <span className="font-semibold">{amount.toLocaleString()}</span>
    </div>
  );
}
