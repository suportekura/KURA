import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ArrowLeft, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  review_type: string;
  created_at: string;
  reviewer_name?: string;
  reviewed_name?: string;
}

export default function Reviews() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);
  const [givenReviews, setGivenReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchReviews = async () => {
      try {
        // Fetch reviews received (as seller or buyer)
        const { data: received, error: receivedError } = await supabase
          .from('reviews')
          .select('*')
          .eq('reviewed_id', user.id)
          .order('created_at', { ascending: false });

        if (receivedError) throw receivedError;

        // Fetch reviews given
        const { data: given, error: givenError } = await supabase
          .from('reviews')
          .select('*')
          .eq('reviewer_id', user.id)
          .order('created_at', { ascending: false });

        if (givenError) throw givenError;

        // Get reviewer/reviewed names
        const receivedWithNames = await Promise.all(
          (received || []).map(async (review) => {
            const { data: profile } = await supabase
              .from('public_profiles')
              .select('display_name')
              .eq('user_id', review.reviewer_id)
              .maybeSingle();
            return {
              ...review,
              reviewer_name: profile?.display_name || 'Usuário',
            };
          })
        );

        const givenWithNames = await Promise.all(
          (given || []).map(async (review) => {
            const { data: profile } = await supabase
              .from('public_profiles')
              .select('display_name')
              .eq('user_id', review.reviewed_id)
              .maybeSingle();
            return {
              ...review,
              reviewed_name: profile?.display_name || 'Usuário',
            };
          })
        );

        setReceivedReviews(receivedWithNames);
        setGivenReviews(givenWithNames);

        // Calculate average rating
        if (receivedWithNames.length > 0) {
          const sum = receivedWithNames.reduce((acc, r) => acc + r.rating, 0);
          setAverageRating(sum / receivedWithNames.length);
        }
      } catch (err) {
        console.error('[Reviews] Error fetching reviews:', err);
        toast({
          title: 'Erro ao carregar avaliações',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [user, toast]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-accent text-accent'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display text-xl font-semibold">Avaliações</h1>
          </div>
        </header>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const totalReviews = receivedReviews.length + givenReviews.length;

  if (totalReviews === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display text-xl font-semibold">Avaliações</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          <div className="card-premium p-8 text-center space-y-3">
            <Star className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">Nenhuma avaliação ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Suas avaliações como comprador e vendedor aparecerão aqui.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl font-semibold">Avaliações</h1>
        </div>
      </header>

      {/* Summary */}
      {averageRating !== null && receivedReviews.length > 0 && (
        <div className="px-4 py-4">
          <Card className="p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {averageRating.toFixed(1)}
              </span>
            </div>
            <div>
              <div className="flex gap-1 mb-1">
                {renderStars(Math.round(averageRating))}
              </div>
              <p className="text-sm text-muted-foreground">
                {receivedReviews.length} {receivedReviews.length === 1 ? 'avaliação recebida' : 'avaliações recebidas'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4">
        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">
              Recebidas ({receivedReviews.length})
            </TabsTrigger>
            <TabsTrigger value="given">
              Dadas ({givenReviews.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4 space-y-3">
            {receivedReviews.map((review) => (
              <div key={review.id} className="card-premium p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{review.reviewer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="mt-1">
                      {renderStars(review.rating)}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2">
                        "{review.comment}"
                      </p>
                    )}
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      {review.review_type === 'buyer_to_seller' ? 'Como vendedor' : 'Como comprador'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="given" className="mt-4 space-y-3">
            {givenReviews.map((review) => (
              <div key={review.id} className="card-premium p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{review.reviewed_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="mt-1">
                      {renderStars(review.rating)}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2">
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
