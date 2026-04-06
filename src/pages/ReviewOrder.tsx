import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface OrderInfo {
  id: string;
  reviewed_user_id: string;
  reviewed_user_name: string;
  product_title: string;
  product_image: string;
  review_type: 'buyer_to_seller' | 'seller_to_buyer';
}

export default function ReviewOrder() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Determine review direction from URL
  const isSellerReviewingBuyer = searchParams.get('type') === 'seller';
  const reviewType = isSellerReviewingBuyer ? 'seller_to_buyer' : 'buyer_to_seller';

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!orderId || !user) return;

    const fetchOrder = async () => {
      try {
        // Fetch order based on review direction
        const userField = isSellerReviewingBuyer ? 'seller_id' : 'buyer_id';
        const reviewedField = isSellerReviewingBuyer ? 'buyer_id' : 'seller_id';

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            buyer_id,
            seller_id,
            order_items (
              title,
              image
            )
          `)
          .eq('id', orderId)
          .eq(userField, user.id)
          .eq('status', 'delivered')
          .maybeSingle();

        if (orderError) throw orderError;

        if (!orderData) {
          toast({
            title: 'Pedido não encontrado',
            description: 'Este pedido não existe ou não pode ser avaliado.',
            variant: 'destructive',
          });
          navigate(isSellerReviewingBuyer ? '/my-sales' : '/my-purchases');
          return;
        }

        // Check if already reviewed
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('order_id', orderId)
          .eq('review_type', reviewType)
          .maybeSingle();

        if (existingReview) {
          toast({
            title: 'Já avaliado',
            description: 'Você já avaliou este pedido.',
          });
          navigate(isSellerReviewingBuyer ? '/my-sales' : '/my-purchases');
          return;
        }

        // Get reviewed user's profile
        const reviewedUserId = isSellerReviewingBuyer ? orderData.buyer_id : orderData.seller_id;
        const { data: reviewedProfile } = await supabase
          .from('public_profiles')
          .select('display_name')
          .eq('user_id', reviewedUserId)
          .maybeSingle();

        setOrder({
          id: orderData.id,
          reviewed_user_id: reviewedUserId,
          reviewed_user_name: reviewedProfile?.display_name || (isSellerReviewingBuyer ? 'Comprador' : 'Vendedor'),
          product_title: orderData.order_items?.[0]?.title || 'Produto',
          product_image: orderData.order_items?.[0]?.image || '',
          review_type: reviewType,
        });
      } catch (err) {
        console.error('[ReviewOrder] Error:', err);
        toast({
          title: 'Erro ao carregar',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user, navigate, toast, isSellerReviewingBuyer, reviewType]);

  const handleSubmit = async () => {
    if (!user || !order || rating === 0) {
      toast({
        title: 'Avaliação incompleta',
        description: 'Selecione uma nota de 1 a 5 estrelas.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          order_id: order.id,
          reviewer_id: user.id,
          reviewed_id: order.reviewed_user_id,
          rating,
          comment: comment.trim() || null,
          review_type: order.review_type,
        });

      if (error) throw error;

      toast({
        title: 'Avaliação enviada! ⭐',
        description: 'Obrigado pelo seu feedback.',
      });

      navigate(isSellerReviewingBuyer ? '/my-sales' : '/my-purchases');
    } catch (err) {
      console.error('[ReviewOrder] Submit error:', err);
      toast({
        title: 'Erro ao enviar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const pageTitle = isSellerReviewingBuyer ? 'Avaliar Comprador' : 'Avaliar Compra';
  const userLabel = isSellerReviewingBuyer ? 'Comprador' : 'Vendedor';

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
          <h1 className="font-display text-xl font-semibold">{pageTitle}</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Product Preview */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            {order.product_image && (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                <img
                  src={order.product_image}
                  alt={order.product_title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <p className="font-medium">{order.product_title}</p>
              <p className="text-sm text-muted-foreground">
                {userLabel}: {order.reviewed_user_name}
              </p>
            </div>
          </div>
        </Card>

        {/* Rating */}
        <div className="space-y-3 text-center">
          <Label className="text-base">
            {isSellerReviewingBuyer 
              ? 'Como foi a experiência com este comprador?' 
              : 'Como foi sua experiência?'}
          </Label>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'w-10 h-10 transition-colors',
                    (hoverRating || rating) >= star
                      ? 'fill-accent text-accent'
                      : 'text-muted-foreground/30'
                  )}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {rating === 0 && 'Selecione uma nota'}
            {rating === 1 && 'Péssimo'}
            {rating === 2 && 'Ruim'}
            {rating === 3 && 'Regular'}
            {rating === 4 && 'Bom'}
            {rating === 5 && 'Excelente'}
          </p>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <Label htmlFor="comment">Comentário (opcional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={isSellerReviewingBuyer 
              ? "Conte como foi sua experiência com o comprador..."
              : "Conte como foi sua experiência com o vendedor..."}
            className="input-premium min-h-[120px] resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {comment.length}/500
          </p>
        </div>

        {/* Submit */}
        <Button
          className="w-full btn-primary h-14"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Enviar Avaliação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
