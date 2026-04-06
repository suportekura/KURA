import { motion } from 'framer-motion';
import { MapPin, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product, ProductGender } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ReputationBadge } from '@/components/reputation';
import { VerificationBadge, type VerificationLevel } from '@/components/reputation';
import { gridItem, cardInteraction } from '@/lib/animations';

interface ProductCardProps {
  product: Product & { gender?: ProductGender; status?: string; isBoosted?: boolean };
  index?: number;
}

const conditionLabels = {
  novo: 'Novo',
  usado: 'Usado',
};

const genderLabels: Record<ProductGender, string> = {
  M: 'Masc',
  F: 'Fem',
  U: 'Uni',
};

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const discount = product.originalPrice 
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const distanceDisplay = product.distance !== undefined && product.distance !== null && product.distance > 0
    ? `${product.distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
    : null;

  return (
    <motion.div
      variants={gridItem}
      {...cardInteraction}
      layout
    >
      <Link
        to={`/product/${product.id}`}
        className="block group"
      >
        <div className="card-premium overflow-hidden">
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden bg-olive-muted">
            {!imageLoaded && (
              <Skeleton className="absolute inset-0 w-full h-full" />
            )}
            <img
              src={product.images[0]}
              alt={product.title}
              className={cn(
                'w-full h-full object-cover transition-all duration-300',
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
              )}
              onLoad={() => setImageLoaded(true)}
            />

            {discount > 0 && (
              <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0.5">
                -{discount}%
              </Badge>
            )}

            <div className="absolute top-2 right-2 flex gap-1">
              {product.gender && product.gender !== 'U' && (
                <Badge 
                  variant="secondary" 
                  className="bg-background/90 backdrop-blur-sm text-foreground border-0 text-[10px] px-1.5 py-0.5"
                >
                  {genderLabels[product.gender]}
                </Badge>
              )}
              <Badge 
                variant="secondary" 
                className="bg-background/90 backdrop-blur-sm text-foreground border-0 text-[10px] px-1.5 py-0.5"
              >
                {conditionLabels[product.condition]}
              </Badge>
            </div>

            {distanceDisplay && (
              <Badge 
                variant="secondary" 
                className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm text-foreground border-0 text-[10px] px-1.5 py-0.5"
              >
                <MapPin className="w-2.5 h-2.5 mr-0.5" />
                {distanceDisplay}
              </Badge>
            )}

            {product.status === 'reserved' && (
              <Badge 
                className="absolute bottom-2 right-2 bg-primary/90 backdrop-blur-sm text-primary-foreground border-0 text-[10px] px-1.5 py-0.5"
              >
                Em negociação
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="p-2 space-y-1">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground leading-tight line-clamp-1">
                {product.title}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {product.brand} • {product.size}
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-sm font-semibold text-foreground">
                R$ {product.price}
              </span>
              {product.originalPrice && (
                <span className="text-[10px] text-muted-foreground line-through">
                  R$ {product.originalPrice}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
              <img
                src={product.sellerAvatar}
                alt={product.sellerName}
                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
              />
              <span className="text-[10px] text-muted-foreground truncate max-w-[50px]">
                {product.sellerName.split(' ')[0]}
              </span>
              {product.sellerPlanType && (
                <VerificationBadge 
                  level={product.sellerPlanType === 'loja' ? 'loja' : product.sellerPlanType === 'plus' ? 'plus' : null} 
                  size="sm" 
                  showTooltip={false} 
                />
              )}
              <div className="ml-auto">
                {product.isBoosted ? (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-primary text-primary" />
                    <span className="text-[10px] font-medium text-primary">Destaque</span>
                  </div>
                ) : (
                  <ReputationBadge
                    reviewsCount={product.sellerReviewsCount}
                    reviewsSum={product.sellerReviewsSum}
                    type="seller"
                    size="sm"
                    showLabel={false}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
