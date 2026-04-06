import badgeVerified from '@/assets/badge-verified.png';
import badgeStore from '@/assets/badge-store.png';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type VerificationLevel = 'plus' | 'loja' | null;

interface VerificationBadgeProps {
  level: VerificationLevel;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sizeMap = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const labelMap: Record<string, string> = {
  plus: 'Vendedor Verificado',
  loja: 'Loja Oficial',
};

export function VerificationBadge({ level, size = 'sm', showTooltip = true }: VerificationBadgeProps) {
  if (!level) return null;

  const badge = (
    <img
      src={level === 'plus' ? badgeVerified : badgeStore}
      alt={labelMap[level]}
      className={`${sizeMap[size]} inline-block shrink-0`}
    />
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{labelMap[level]}</p>
      </TooltipContent>
    </Tooltip>
  );
}
