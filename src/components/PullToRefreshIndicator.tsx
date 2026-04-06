import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <motion.div
      className="flex items-center justify-center w-full overflow-hidden"
      style={{ height: pullDistance }}
      animate={isRefreshing ? { height: 56 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center',
          'bg-primary/10 border border-primary/20'
        )}
      >
        <Loader2
          className={cn(
            'w-5 h-5 text-primary transition-opacity',
            isRefreshing && 'animate-spin'
          )}
          style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      </div>
    </motion.div>
  );
}
