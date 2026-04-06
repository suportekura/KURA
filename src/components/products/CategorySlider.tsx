import { categories } from '@/data/mockProducts';
import { cn } from '@/lib/utils';
import { ProductCategory } from '@/types';
import { Sparkles } from 'lucide-react';

interface CategorySliderProps {
  selectedCategory?: ProductCategory;
  onCategoryChange: (category?: ProductCategory) => void;
}

export function CategorySlider({ selectedCategory, onCategoryChange }: CategorySliderProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <div className="flex gap-3 pb-2">
        <button
          onClick={() => onCategoryChange(undefined)}
          className={cn(
            'flex flex-col items-center gap-2 min-w-[72px] p-3 rounded-2xl transition-all duration-300',
            !selectedCategory 
              ? 'bg-primary text-primary-foreground shadow-card' 
              : 'bg-card hover:bg-olive-warm'
          )}
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-xs font-medium whitespace-nowrap">Todos</span>
        </button>
        
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id as ProductCategory)}
              className={cn(
                'flex flex-col items-center gap-2 min-w-[72px] p-3 rounded-2xl transition-all duration-300',
                selectedCategory === category.id 
                  ? 'bg-primary text-primary-foreground shadow-card' 
                  : 'bg-card hover:bg-olive-warm'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium whitespace-nowrap">{category.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
