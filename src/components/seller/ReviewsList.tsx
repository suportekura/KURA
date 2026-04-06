import { useState, useEffect } from 'react';
import { Star, ShoppingBag, Store } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateWeightedRating } from '@/components/reputation/ReputationBadge';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
  review_type: string;
}

interface SellerReputation {
  seller_reviews_count: number;
  seller_reviews_sum: number;
  buyer_reviews_count: number;
  buyer_reviews_sum: number;
}

interface ReviewsListProps {
  sellerId: string;
}

export function ReviewsList({ sellerId }: ReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reputation, setReputation] = useState<SellerReputation | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      
      // Fetch seller reputation data
      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('seller_reviews_count, seller_reviews_sum, buyer_reviews_count, buyer_reviews_sum')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (profileData) {
        setReputation({
          seller_reviews_count: profileData.seller_reviews_count || 0,
          seller_reviews_sum: Number(profileData.seller_reviews_sum) || 0,
          buyer_reviews_count: profileData.buyer_reviews_count || 0,
          buyer_reviews_sum: Number(profileData.buyer_reviews_sum) || 0,
        });
      }
      
      // Fetch reviews where the seller was reviewed
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id, review_type')
        .eq('reviewed_id', sellerId)
        .order('created_at', { ascending: false });

      if (error || !reviewsData) {
        setLoading(false);
        return;
      }

      if (reviewsData.length === 0) {
        setReviews([]);
        setLoading(false);
        return;
      }

      // Get reviewer profiles
      const reviewerIds = reviewsData.map(r => r.reviewer_id);
      
      const { data: profilesData } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', reviewerIds);

      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );

      const enrichedReviews = reviewsData.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_id: r.reviewer_id,
        reviewer_name: profilesMap.get(r.reviewer_id)?.display_name || null,
        reviewer_avatar: profilesMap.get(r.reviewer_id)?.avatar_url || null,
        review_type: r.review_type,
      }));

      setReviews(enrichedReviews);
      setLoading(false);
    };

    fetchReviews();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhuma avaliação recebida ainda</p>
      </div>
    );
  }

  // Calculate weighted ratings
  const sellerRating = reputation 
    ? calculateWeightedRating(reputation.seller_reviews_sum, reputation.seller_reviews_count)
    : 5.0;
  const buyerRating = reputation 
    ? calculateWeightedRating(reputation.buyer_reviews_sum, reputation.buyer_reviews_count)
    : 5.0;
  const isSellerNew = !reputation || reputation.seller_reviews_count <= 3;
  const isBuyerNew = !reputation || reputation.buyer_reviews_count <= 3;

  return (
    <div className="space-y-4 py-4">
      {/* Reputation Summary Card */}
      {reputation && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
          <div className="grid grid-cols-2 gap-4">
            {/* Seller Rating */}
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <Store className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Vendedor</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-semibold text-foreground">
                  {isSellerNew ? 'Novo' : sellerRating.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isSellerNew 
                  ? 'Poucos reviews' 
                  : `${reputation.seller_reviews_count} avaliações`}
              </p>
            </div>

            {/* Buyer Rating */}
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Comprador</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="font-semibold text-foreground">
                  {isBuyerNew ? 'Novo' : buyerRating.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isBuyerNew 
                  ? 'Poucos reviews' 
                  : `${reputation.buyer_reviews_count} avaliações`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.map((review) => {
        const initials = review.reviewer_name?.slice(0, 2).toUpperCase() || 'US';
        const formattedDate = format(new Date(review.created_at), "d 'de' MMM, yyyy", { locale: ptBR });
        const isFromSale = review.review_type === 'buyer_to_seller';
        
        return (
          <div
            key={review.id}
            className="p-4 rounded-xl bg-muted/30 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={review.reviewer_avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">
                    {review.reviewer_name || 'Usuário'}
                  </p>
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                  >
                    {isFromSale ? (
                      <span className="flex items-center gap-1">
                        <Store className="h-2.5 w-2.5" />
                        Venda
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-2.5 w-2.5" />
                        Compra
                      </span>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formattedDate}</p>
              </div>
            </div>
            
            {/* Rating Stars */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= review.rating
                      ? 'fill-accent text-accent'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
            
            {review.comment && (
              <p className="text-sm text-foreground/80">{review.comment}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
