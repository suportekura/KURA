import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ReputationBadge, VerificationBadge, type VerificationLevel } from '@/components/reputation';

interface SellerCardProps {
  sellerId: string;
  displayName: string | null;
  avatarUrl: string | null;
  sellerReviewsCount?: number;
  sellerReviewsSum?: number;
  verificationLevel?: VerificationLevel;

}

export function SellerCard({ 
  sellerId, 
  displayName, 
  avatarUrl, 
  sellerReviewsCount = 0, 
  sellerReviewsSum = 0,
  verificationLevel = null,
}: SellerCardProps) {
  const initials = displayName?.slice(0, 2).toUpperCase() || 'US';

  return (
    <div className="card-premium p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarImage src={avatarUrl || undefined} alt={displayName || 'Vendedor'} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground truncate inline-flex items-center gap-1">
            {displayName || 'Vendedor'}
            <VerificationBadge level={verificationLevel} size="sm" />
          </h4>
          <ReputationBadge
            reviewsCount={sellerReviewsCount}
            reviewsSum={sellerReviewsSum}
            type="seller"
            size="sm"
          />
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 gap-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Link to={`/seller/${sellerId}`}>
            Ver Vendedor
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
