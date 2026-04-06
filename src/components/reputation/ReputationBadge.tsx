import { Star } from 'lucide-react';

interface ReputationBadgeProps {
  reviewsCount: number;
  reviewsSum: number;
  type?: 'seller' | 'buyer';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// Calculate weighted rating using the formula:
// (5 * 10 + sum) / (10 + count)
// Initial weight: 10 fictitious reviews at 5 stars
function calculateWeightedRating(reviewsSum: number, reviewsCount: number): number {
  const initialRating = 5.0;
  const initialWeight = 10;
  
  return Number(
    ((initialRating * initialWeight + (reviewsSum || 0)) / (initialWeight + (reviewsCount || 0))).toFixed(2)
  );
}

export function ReputationBadge({ 
  reviewsCount, 
  reviewsSum, 
  type = 'seller',
  size = 'md',
  showLabel = true 
}: ReputationBadgeProps) {
  const rating = calculateWeightedRating(reviewsSum, reviewsCount);
  const isNew = reviewsCount <= 3;
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  const starSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  if (isNew) {
    return (
      <div className={`flex items-center gap-1 ${sizeClasses[size]}`}>
        <Star className={`${starSizes[size]} fill-primary text-primary`} />
        <span className="font-medium text-foreground">{rating.toFixed(2)}</span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-1 ${sizeClasses[size]}`}>
      <Star className={`${starSizes[size]} fill-primary text-primary`} />
      <span className="font-medium text-foreground">{rating.toFixed(2)}</span>
      {showLabel && (
        <span className="text-muted-foreground">
          ({reviewsCount} {reviewsCount === 1 ? 'avaliação' : 'avaliações'})
        </span>
      )}
    </div>
  );
}

// Hook to get reputation data from profile
export function useReputation(profile: {
  seller_reviews_count?: number;
  seller_reviews_sum?: number;
  buyer_reviews_count?: number;
  buyer_reviews_sum?: number;
} | null) {
  if (!profile) {
    return {
      seller: { count: 0, sum: 0, rating: 5.0, isNew: true },
      buyer: { count: 0, sum: 0, rating: 5.0, isNew: true }
    };
  }
  
  const sellerCount = profile.seller_reviews_count || 0;
  const sellerSum = profile.seller_reviews_sum || 0;
  const buyerCount = profile.buyer_reviews_count || 0;
  const buyerSum = profile.buyer_reviews_sum || 0;
  
  return {
    seller: {
      count: sellerCount,
      sum: sellerSum,
      rating: calculateWeightedRating(sellerSum, sellerCount),
      isNew: sellerCount <= 3
    },
    buyer: {
      count: buyerCount,
      sum: buyerSum,
      rating: calculateWeightedRating(buyerSum, buyerCount),
      isNew: buyerCount <= 3
    }
  };
}

export { calculateWeightedRating };
