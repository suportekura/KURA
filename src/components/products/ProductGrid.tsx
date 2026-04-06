import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { Loader2 } from 'lucide-react';
import { gridStagger } from '@/lib/animations';

interface ProductGridProps {
  products: Product[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function ProductGrid({ 
  products, 
  hasNextPage, 
  isFetchingNextPage, 
  fetchNextPage 
}: ProductGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px',
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  if (products.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center py-16 px-4"
      >
        <div className="w-20 h-20 rounded-full bg-olive-warm flex items-center justify-center mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          Nenhum item encontrado
        </h3>
        <p className="text-muted-foreground text-center text-sm">
          Tente ajustar os filtros ou buscar por outras categorias
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-3"
        variants={gridStagger}
        initial="hidden"
        animate="visible"
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </motion.div>
      
      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="flex justify-center py-4">
        {isFetchingNextPage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando mais...</span>
          </motion.div>
        )}
        {!hasNextPage && products.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Você viu todos os {products.length} itens
          </p>
        )}
      </div>
    </div>
  );
}
