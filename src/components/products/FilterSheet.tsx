import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X, MapPin } from 'lucide-react';
import { DURATION, EASE } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { FilterOptions, ProductCategory, ProductGender } from '@/types';
import { sizes, conditions, categories, getSizesForCategory } from '@/data/mockProducts';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';

const genderOptions: { id: ProductGender; label: string }[] = [
  { id: 'M', label: 'Masculino' },
  { id: 'F', label: 'Feminino' },
  { id: 'U', label: 'Unissex' },
];

interface FilterSheetProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  activeFiltersCount: number;
  selectedCategory?: ProductCategory;
  onCategoryChange: (category?: ProductCategory) => void;
}

export function FilterSheet({ 
  filters, 
  onFiltersChange, 
  activeFiltersCount,
  selectedCategory,
  onCategoryChange,
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [localCategory, setLocalCategory] = useState<ProductCategory | undefined>(selectedCategory);
  const [open, setOpen] = useState(false);
  const { hasLocation, setShowLocationPrompt, requestLocation, loading: locationLoading } = useGeolocation();

  // Get sizes based on selected category
  const availableSizes = localCategory 
    ? getSizesForCategory(localCategory) 
    : sizes;

  // Sync local state when sheet opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
      setLocalCategory(selectedCategory);
    }
  }, [open, filters, selectedCategory]);

  // Clear size filter when category changes
  useEffect(() => {
    if (localCategory) {
      const validSizes = getSizesForCategory(localCategory);
      const currentSizes = localFilters.sizes || [];
      const filteredSizes = currentSizes.filter(s => validSizes.includes(s));
      if (filteredSizes.length !== currentSizes.length) {
        setLocalFilters({ ...localFilters, sizes: filteredSizes.length ? filteredSizes : undefined });
      }
    }
  }, [localCategory]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onCategoryChange(localCategory);
    setOpen(false);
  };

  const handleClear = () => {
    const emptyFilters: FilterOptions = {};
    setLocalFilters(emptyFilters);
    setLocalCategory(undefined);
    onFiltersChange(emptyFilters);
    onCategoryChange(undefined);
  };

  const toggleSize = (size: string) => {
    const current = localFilters.sizes || [];
    const updated = current.includes(size)
      ? current.filter(s => s !== size)
      : [...current, size];
    setLocalFilters({ ...localFilters, sizes: updated.length ? updated : undefined });
  };

  const toggleCondition = (condition: string) => {
    const current = localFilters.condition || [];
    const updated = current.includes(condition as any)
      ? current.filter(c => c !== condition)
      : [...current, condition as any];
    setLocalFilters({ ...localFilters, condition: updated.length ? updated : undefined });
  };

  // Calculate total active filters including category and gender
  const totalActiveFilters = activeFiltersCount 
    + (selectedCategory ? 1 : 0) 
    + (localFilters.gender ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="default" size="sm" className="relative rounded-xl h-9 px-3 text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Filtros
          {totalActiveFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-background text-foreground text-[10px] rounded-full flex items-center justify-center border border-border">
              {totalActiveFilters}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-background border-border/50 overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-2xl">Filtros</SheetTitle>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: DURATION.normal, ease: EASE.out }}
          className="space-y-8"
        >

          {/* Gender Filter */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Gênero</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setLocalFilters({ ...localFilters, gender: undefined })}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  !localFilters.gender
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border/50 hover:border-primary/50'
                )}
              >
                Todos
              </button>
              {genderOptions.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setLocalFilters({ ...localFilters, gender: g.id })}
                  className={cn(
                    'px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    localFilters.gender === g.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Categoria</Label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLocalCategory(undefined)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  !localCategory
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border/50 hover:border-primary/50'
                )}
              >
                Todas
              </button>
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setLocalCategory(category.id as ProductCategory)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2',
                      localCategory === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border/50 hover:border-primary/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Distância máxima</Label>
            
            {!hasLocation ? (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Ative sua localização
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Para filtrar por distância, precisamos saber onde você está.
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => requestLocation()}
                  disabled={locationLoading}
                  className="w-full"
                >
                  {locationLoading ? 'Obtendo...' : 'Permitir localização'}
                </Button>
              </div>
            ) : (
              <div className="px-2">
                <Slider
                  value={[localFilters.maxDistance || 10]}
                  onValueChange={([value]) => setLocalFilters({ ...localFilters, maxDistance: value })}
                  max={50}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                  <span>1 km</span>
                  <span className="font-medium text-foreground">
                    {localFilters.maxDistance || 10} km
                  </span>
                  <span>50 km</span>
                </div>
              </div>
            )}
          </div>

          {/* Price Range */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Faixa de preço</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Mínimo</Label>
                <div className="mt-1">
                  <CurrencyInput
                    value={localFilters.priceMin?.toString() || ''}
                    onChange={(value) => {
                      const num = value ? parseFloat(value) : undefined;
                      setLocalFilters({ ...localFilters, priceMin: num });
                    }}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Máximo</Label>
                <div className="mt-1">
                  <CurrencyInput
                    value={localFilters.priceMax?.toString() || ''}
                    onChange={(value) => {
                      const num = value ? parseFloat(value) : undefined;
                      setLocalFilters({ ...localFilters, priceMax: num });
                    }}
                    placeholder="1.000,00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sizes - Dynamic based on category */}
          <div className="space-y-4">
            <Label className="text-base font-medium">
              Tamanhos
              {localCategory && (
                <span className="text-xs text-muted-foreground ml-2 font-normal">
                  ({categories.find(c => c.id === localCategory)?.label})
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    localFilters.sizes?.includes(size)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Estado</Label>
            <div className="space-y-3">
              {conditions.map((condition) => (
                <label
                  key={condition.id}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Checkbox
                    checked={localFilters.condition?.includes(condition.id as any) || false}
                    onCheckedChange={() => toggleCondition(condition.id)}
                  />
                  <span className="text-sm">{condition.label}</span>
                </label>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Apply Button */}
        <div className="sticky bottom-0 pt-6 pb-4 bg-background mt-8">
          <Button onClick={handleApply} className="w-full btn-primary">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
