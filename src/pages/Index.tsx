import { motion, AnimatePresence } from 'framer-motion';
import defaultSellerAvatar from '@/assets/default-seller-avatar.png';
import { useState, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SortSelector } from '@/components/products/SortSelector';
import { FilterSheet } from '@/components/products/FilterSheet';
import { ProductGrid } from '@/components/products/ProductGrid';
import { useInfiniteProducts } from '@/hooks/useInfiniteProducts';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { FilterOptions, ProductCategory, SortOption, Product } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductWithDistance } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import { fadeUpVariants, DURATION, EASE } from '@/lib/animations';

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | undefined>();
  const [sortOption, setSortOption] = useState<SortOption>('distance');
  const [filters, setFilters] = useState<FilterOptions>({});
  const { hasLocation } = useGeolocation();
  const { isVisible: isControlsVisible } = useScrollDirection({ threshold: 100 });

  const { 
    data, 
    isLoading, 
    error, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    refetch,
  } = useInfiniteProducts({
    category: selectedCategory,
    filters,
    sortOption,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.sizes?.length) count++;
    if (filters.condition?.length) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.maxDistance && hasLocation) count++;
    return count;
  }, [filters, hasLocation]);

  const realProducts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.products);
  }, [data]);

  const displayProducts = useMemo(() => {
    return realProducts.map((p: ProductWithDistance): Product => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      originalPrice: p.originalPrice || undefined,
      size: p.size,
      brand: p.brand,
      category: p.category,
      condition: p.condition,
      images: p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800'],
      sellerId: p.sellerId,
      sellerName: p.sellerDisplayName || 'Vendedor',
      sellerAvatar: p.sellerAvatarUrl || defaultSellerAvatar,
      sellerReviewsCount: 0,
      sellerReviewsSum: 0,
      sellerPlanType: p.sellerPlanType || null,
      distance: p.distance ?? 0,
      city: p.sellerCity || 'Localização desconhecida',
      createdAt: p.createdAt,
      isFavorite: false,
      isBoosted: (p as any).isBoosted ?? false,
    } as any));
  }, [realProducts]);

  return (
    <AppLayout>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
        className="px-4 py-4 space-y-6"
      >
        {/* Welcome Section */}
        <motion.div variants={fadeUpVariants} transition={{ duration: DURATION.normal, ease: EASE.out }} className="space-y-1">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Descubra
          </h1>
          <p className="text-muted-foreground">
            Peças únicas perto de você
          </p>
        </motion.div>

        {/* Sticky Controls Bar */}
        <div 
          className={cn(
            "sticky z-30 -mx-4 px-4 py-3 glass-effect border-b border-border/30 transition-all duration-200 ease-out",
            isControlsVisible 
              ? "top-[60px] opacity-100 translate-y-0" 
              : "top-[60px] opacity-0 -translate-y-full pointer-events-none"
          )}
        >
          <div className="space-y-3">
          <div className="flex items-center gap-2">
              <FilterSheet 
                filters={filters}
                onFiltersChange={setFilters}
                activeFiltersCount={activeFiltersCount}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
              <SortSelector value={sortOption} onChange={setSortOption} />
            </div>
            
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <p className="text-xs text-muted-foreground">
                {displayProducts.length} itens encontrados
              </p>
            )}
          </div>
        </div>

        <div className="h-0" />

        {/* Product Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sortOption}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
                {[...Array(8)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="space-y-3"
                  >
                    <Skeleton className="aspect-square rounded-2xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </motion.div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Erro ao carregar produtos</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            ) : (
              <ProductGrid 
                products={displayProducts} 
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
};

export default Index;
