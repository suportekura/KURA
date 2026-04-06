import { MapPin, TrendingDown, TrendingUp, Sparkles, ArrowUpDown, Check } from 'lucide-react';
import { SortOption } from '@/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortOptions = [
  { value: 'distance' as SortOption, label: 'Próximos', icon: MapPin },
  { value: 'price_asc' as SortOption, label: 'Menor preço', icon: TrendingDown },
  { value: 'price_desc' as SortOption, label: 'Maior preço', icon: TrendingUp },
  { value: 'newest' as SortOption, label: 'Recentes', icon: Sparkles },
];

export function SortSelector({ value, onChange }: SortSelectorProps) {
  const activeOption = sortOptions.find(o => o.value === value);
  const ActiveIcon = activeOption?.icon || ArrowUpDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 text-xs gap-1.5">
          <ActiveIcon className="w-3.5 h-3.5" />
          {activeOption?.label || 'Ordenar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {sortOptions.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'font-semibold'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="flex-1">{option.label}</span>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
