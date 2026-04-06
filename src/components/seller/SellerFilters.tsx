import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const categoryLabels: Record<string, string> = {
  acessorios: 'Acessórios',
  blazer: 'Blazers',
  bodies: 'Bodies',
  bolsas_carteiras: 'Bolsas & Carteiras',
  bones_chapeus: 'Bonés & Chapéus',
  calcados: 'Calçados',
  calca: 'Calças',
  camisa: 'Camisas',
  camiseta: 'Camisetas',
  casaco: 'Casacos',
  jaqueta: 'Jaquetas',
  lencos_cachecois: 'Lenços & Cachecóis',
  moda_praia: 'Moda Praia',
  oculos: 'Óculos',
  outros: 'Outros',
  roupas_esportivas: 'Roupas Esportivas',
  roupas_infantis: 'Roupas Infantis',
  roupas_intimas: 'Roupas Íntimas',
  saia: 'Saias',
  shorts: 'Shorts',
  vestido: 'Vestidos',
};

const genderLabels: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  U: 'Unissex',
};

const sizeOptions = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

const priceRanges = [
  { label: 'Até R$ 50', min: 0, max: 50 },
  { label: 'R$ 50 - R$ 100', min: 50, max: 100 },
  { label: 'R$ 100 - R$ 200', min: 100, max: 200 },
  { label: 'R$ 200 - R$ 500', min: 200, max: 500 },
  { label: 'Acima de R$ 500', min: 500, max: undefined },
];

interface SellerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  size: string;
  onSizeChange: (value: string) => void;
  priceRange: { min?: number; max?: number };
  onPriceRangeChange: (range: { min?: number; max?: number }) => void;
}

export function SellerFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  size,
  onSizeChange,
  priceRange,
  onPriceRangeChange,
}: SellerFiltersProps) {
  return (
    <div className="space-y-3 p-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar nesta loja..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Category Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1 rounded-full">
              {category ? categoryLabels[category] : 'Categoria'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onCategoryChange('')}>
              Todas
            </DropdownMenuItem>
            {Object.entries(categoryLabels).map(([cat, label]) => (
              <DropdownMenuItem key={cat} onClick={() => onCategoryChange(cat)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Size Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1 rounded-full">
              {size || 'Tamanho'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onSizeChange('')}>
              Todos
            </DropdownMenuItem>
            {sizeOptions.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onSizeChange(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Price Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1 rounded-full">
              {priceRange.min !== undefined || priceRange.max !== undefined
                ? priceRanges.find(r => r.min === priceRange.min)?.label || 'Preço'
                : 'Preço'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onPriceRangeChange({})}>
              Todos
            </DropdownMenuItem>
            {priceRanges.map((range) => (
              <DropdownMenuItem 
                key={range.label} 
                onClick={() => onPriceRangeChange({ min: range.min, max: range.max })}
              >
                {range.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
