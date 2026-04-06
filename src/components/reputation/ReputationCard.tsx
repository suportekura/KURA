import { Star, TrendingUp, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { calculateWeightedRating } from './ReputationBadge';

interface ReputationCardProps {
  sellerReviewsCount: number;
  sellerReviewsSum: number;
  buyerReviewsCount: number;
  buyerReviewsSum: number;
}

export function ReputationCard({
  sellerReviewsCount,
  sellerReviewsSum,
  buyerReviewsCount,
  buyerReviewsSum,
}: ReputationCardProps) {
  const sellerRating = calculateWeightedRating(sellerReviewsSum, sellerReviewsCount);
  const buyerRating = calculateWeightedRating(buyerReviewsSum, buyerReviewsCount);
  
  const isSellerNew = sellerReviewsCount <= 3;
  const isBuyerNew = buyerReviewsCount <= 3;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 fill-primary text-primary" />
        <h3 className="font-medium text-foreground">Sua Reputação</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Seller Rating */}
        <div className="space-y-2 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Vendedor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-primary text-primary" />
            {isSellerNew ? (
              <span className="text-sm text-muted-foreground">Novo</span>
            ) : (
              <span className="text-lg font-bold text-foreground">
                {sellerRating.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sellerReviewsCount} {sellerReviewsCount === 1 ? 'avaliação' : 'avaliações'}
          </p>
        </div>

        {/* Buyer Rating */}
        <div className="space-y-2 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Comprador
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-primary text-primary" />
            {isBuyerNew ? (
              <span className="text-sm text-muted-foreground">Novo</span>
            ) : (
              <span className="text-lg font-bold text-foreground">
                {buyerRating.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {buyerReviewsCount} {buyerReviewsCount === 1 ? 'avaliação' : 'avaliações'}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Usuários novos iniciam com nota 5.0 ⭐
      </p>
    </Card>
  );
}
