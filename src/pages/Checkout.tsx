import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, Bike, Loader2, Check, Clock, MessageCircle, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type DeliveryMethod = 'pickup' | 'local_delivery';

interface DeliveryOption {
  id: DeliveryMethod;
  icon: typeof Package;
  label: string;
  description: string;
  available: boolean;
}

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: 'all' | 'specific';
  listing_id: string | null;
}

const deliveryOptions: DeliveryOption[] = [
  { id: 'pickup', icon: Package, label: 'Retirada', description: 'Combinar local com vendedor', available: true },
  { id: 'local_delivery', icon: Bike, label: 'Entrega Local', description: 'Motoboy ou próprio', available: false },
];

interface OfferData {
  offerId: string;
  amount: number;
  product: {
    id: string;
    title: string;
    images: string[];
    price: number;
    size: string;
    brand: string | null;
    seller_id: string;
  };
  sellerName: string;
  sellerAvatar: string | null;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sellerId = searchParams.get('seller');
  const offerId = searchParams.get('offerId');

  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { groupedBySeller, removeItem, items } = useCart();

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMethod>('pickup');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const [offerData, setOfferData] = useState<OfferData | null>(null);
  const [offerLoading, setOfferLoading] = useState(() => !!searchParams.get('offerId'));

  // Filter to only the selected seller's items
  const sellerGroup = useMemo(() => {
    if (!sellerId) return null;
    return groupedBySeller.find(group => group.sellerId === sellerId);
  }, [groupedBySeller, sellerId]);

  // Get available items for this seller
  const sellerItems = sellerGroup?.items || [];
  const subtotal = sellerGroup?.subtotal || 0;

  // Calculate discount
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;

    if (appliedCoupon.applies_to === 'specific' && appliedCoupon.listing_id) {
      // Only discount the specific product
      const matchingItem = sellerItems.find(item => item.productId === appliedCoupon.listing_id);
      if (!matchingItem) return 0;

      if (appliedCoupon.discount_type === 'percentage') {
        return Math.round((matchingItem.price * appliedCoupon.discount_value) / 100 * 100) / 100;
      }
      return Math.min(appliedCoupon.discount_value, matchingItem.price);
    }

    // Applies to all
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round((subtotal * appliedCoupon.discount_value) / 100 * 100) / 100;
    }
    return Math.min(appliedCoupon.discount_value, subtotal);
  }, [appliedCoupon, sellerItems, subtotal]);

  const totalAmount = Math.max(0, subtotal - discount);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (!sellerId) return;

    setCouponLoading(true);
    setCouponError('');

    try {
      // First check if coupon exists at all (regardless of seller)
      const { data: anyMatch } = await supabase
        .from('coupons')
        .select('id, user_id')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (anyMatch && anyMatch.user_id !== sellerId) {
        setCouponError('Este cupom não é válido para este vendedor');
        setCouponLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, discount_type, discount_value, applies_to, listing_id, max_uses, use_count, expires_at')
        .eq('user_id', sellerId)
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCouponError('Cupom inválido ou não encontrado');
        setCouponLoading(false);
        return;
      }

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setCouponError('Este cupom está expirado');
        setCouponLoading(false);
        return;
      }

      // Check usage limit
      if (data.max_uses !== null && data.use_count >= data.max_uses) {
        setCouponError('Este cupom atingiu o limite de uso');
        setCouponLoading(false);
        return;
      }

      // Check if specific listing is in the cart
      if (data.applies_to === 'specific' && data.listing_id) {
        const hasProduct = sellerItems.some(item => item.productId === data.listing_id);
        if (!hasProduct) {
          setCouponError('Este cupom não se aplica aos itens do seu carrinho');
          setCouponLoading(false);
          return;
        }
      }

      setAppliedCoupon({
        id: data.id,
        code: data.code,
        discount_type: data.discount_type as 'percentage' | 'fixed',
        discount_value: data.discount_value,
        applies_to: data.applies_to as 'all' | 'specific',
        listing_id: data.listing_id,
      });

      toast({ title: 'Cupom aplicado! 🎉' });
    } catch (err) {
      console.error('[Checkout] Coupon error:', err);
      setCouponError('Erro ao validar cupom');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Offer mode: fetch offer data when offerId is present
  useEffect(() => {
    if (!offerId || !user) return;

    const fetchOfferData = async () => {
      setOfferLoading(true);
      try {
        const { data: offerRow, error } = await supabase
          .from('offers')
          .select(`
            id, amount, status, sender_id, product_id,
            products(id, title, images, price, size, brand, seller_id)
          `)
          .eq('id', offerId)
          .eq('sender_id', user.id)
          .eq('status', 'accepted')
          .maybeSingle();

        if (error) throw error;

        if (!offerRow || !offerRow.products) {
          toast({
            title: 'Oferta não encontrada ou não está mais disponível',
            variant: 'destructive',
          });
          navigate('/messages');
          return;
        }

        const product = offerRow.products as OfferData['product'];

        // Fetch seller profile separately
        const { data: sellerProfile } = await supabase
          .from('public_profiles')
          .select('display_name, avatar_url')
          .eq('user_id', product.seller_id)
          .maybeSingle();

        setOfferData({
          offerId: offerRow.id,
          amount: offerRow.amount,
          product,
          sellerName: sellerProfile?.display_name || 'Vendedor',
          sellerAvatar: sellerProfile?.avatar_url || null,
        });
      } catch (err) {
        console.error('[Checkout] Error fetching offer:', err);
        toast({
          title: 'Erro ao carregar oferta',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
        navigate('/messages');
      } finally {
        setOfferLoading(false);
      }
    };

    fetchOfferData();
  }, [offerId, user?.id]);

  const handleConfirmOrder = async () => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado.',
        variant: 'destructive',
      });
      return;
    }

    if (!sellerGroup || sellerItems.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Nenhum item encontrado para este vendedor.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Collect all product IDs to reserve for this seller
      const allProductIds = sellerItems.map(item => item.productId);

      // STEP 1: Check if any products are already reserved/sold BEFORE proceeding
      const { data: productStatuses, error: statusError } = await supabase
        .from('products')
        .select('id, status')
        .in('id', allProductIds);

      if (statusError) throw statusError;

      const unavailableProducts = productStatuses?.filter(
        p => p.status === 'reserved' || p.status === 'sold'
      );

      if (unavailableProducts && unavailableProducts.length > 0) {
        toast({
          title: 'Produto indisponível',
          description: 'Um ou mais itens do seu carrinho foram vendidos ou reservados. Por favor, remova-os e tente novamente.',
          variant: 'destructive',
        });
        setSubmitting(false);
        navigate('/cart');
        return;
      }

      // STEP 2: Reserve ALL products using secure RPC (bypasses RLS, triggers realtime)
      const { data: reservationResults, error: reserveError } = await supabase
        .rpc('reserve_product_for_checkout', {
          product_ids: allProductIds,
          buyer_id: user.id,
        });

      if (reserveError) {
        console.error('[Checkout] RPC error reserving products:', reserveError);
        throw reserveError;
      }

      // Check if any reservations failed
      const failedReservations = reservationResults?.filter((r: { success: boolean }) => !r.success);
      if (failedReservations && failedReservations.length > 0) {
        const firstError = failedReservations[0] as { error_message: string };
        toast({
          title: 'Produto indisponível',
          description: firstError.error_message || 'Um ou mais produtos não estão disponíveis.',
          variant: 'destructive',
        });
        setSubmitting(false);
        navigate('/cart');
        return;
      }

      // STEP 3: Create order for this seller (with rollback on error)
      let createdOrderId: string | null = null;
      try {
        // Create the order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            seller_id: sellerGroup.sellerId,
            product_id: sellerItems[0].productId, // primary product for conversation context — all items are in order_items
            status: 'pending',
            delivery_method: selectedDelivery,
            total_price: totalAmount,
            delivery_notes: deliveryNotes || null,
            delivery_address: null,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        createdOrderId = order.id;

        // Create order items
        const orderItems = sellerItems.map(item => ({
          order_id: order.id,
          product_id: item.productId,
          title: item.title,
          price: item.price,
          size: item.size,
          brand: item.brand,
          image: item.image,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        // STEP 4: Increment coupon use_count if applied (atomic RPC to prevent TOCTOU race)
        if (appliedCoupon) {
          const { data: incrementOk, error: couponLockError } = await supabase
            .rpc('increment_coupon_use_count', { p_coupon_id: appliedCoupon.id });

          if (couponLockError) throw couponLockError;
          if (incrementOk === false) throw new Error('Cupom atingiu o limite de usos');
          if (incrementOk === null) throw new Error('Erro ao verificar cupom');
        }
      } catch (orderCreationError) {
        // ROLLBACK: Release all reserved products if order creation fails
        console.error('[Checkout] Order creation failed, rolling back reservations:', orderCreationError);

        if (createdOrderId) {
          await supabase.from('order_items').delete().eq('order_id', createdOrderId);
          await supabase.from('orders').delete().eq('id', createdOrderId);
        }
        
        await supabase.rpc('release_product_reservations', {
          product_ids: allProductIds,
        });

        throw orderCreationError;
      }

      // Remove only the items from this seller from the cart
      sellerItems.forEach(item => {
        removeItem(item.id);
      });

      // Create or find conversation with seller and redirect to chat
      const productId = sellerItems[0].productId;
      
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${sellerGroup.sellerId}),and(participant_1.eq.${sellerGroup.sellerId},participant_2.eq.${user.id})`)
        .eq('product_id', productId)
        .maybeSingle();

      let conversationId = existingConv?.id;

      // Create new conversation if doesn't exist
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            participant_1: user.id,
            participant_2: sellerGroup.sellerId,
            product_id: productId,
          })
          .select('id')
          .single();

        if (!convError) {
          conversationId = newConv.id;
        }
      }

      // Send automatic message about order confirmation
      if (conversationId) {
        const discountMsg = appliedCoupon && discount > 0
          ? ` (cupom ${appliedCoupon.code} aplicado: -R$ ${discount.toFixed(2).replace('.', ',')})`
          : '';
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: `🎉 Pedido confirmado${discountMsg}! Olá, acabei de confirmar a compra. Podemos combinar o local e horário para retirada?`,
          });
      }

      toast({
        title: 'Pedido confirmado! 🎉',
        description: 'Combine a retirada com o vendedor pelo chat.',
      });

      // Navigate to chat with seller
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      } else {
        navigate('/my-purchases');
      }
    } catch (err) {
      console.error('[Checkout] Error creating order:', err);
      toast({
        title: 'Erro ao criar pedido',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmOfferOrder = async () => {
    if (!user || !offerData || submitting) return;

    setSubmitting(true);
    try {
      // Reserve product
      const { data: reservationResults, error: reserveError } = await supabase
        .rpc('reserve_product_for_checkout', {
          product_ids: [offerData.product.id],
          buyer_id: user.id,
        });

      if (reserveError) throw reserveError;

      const failedReservations = reservationResults?.filter(
        (r: { success: boolean }) => !r.success
      );
      if (failedReservations && failedReservations.length > 0) {
        toast({
          title: 'Produto indisponível',
          description: 'Este produto não está mais disponível.',
          variant: 'destructive',
        });
        navigate('/messages');
        return;
      }

      let createdOrderId: string | null = null;
      try {
        // Create order at offer price
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            buyer_id: user.id,
            seller_id: offerData.product.seller_id,
            product_id: offerData.product.id,
            status: 'pending',
            delivery_method: selectedDelivery,
            total_price: offerData.amount,
            delivery_notes: deliveryNotes || null,
            delivery_address: null,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        createdOrderId = order.id;

        // Create order item at offer price
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert([{
            order_id: order.id,
            product_id: offerData.product.id,
            title: offerData.product.title,
            price: offerData.amount,
            size: offerData.product.size,
            brand: offerData.product.brand,
            image: offerData.product.images?.[0] || null,
          }]);

        if (itemsError) throw itemsError;

        // Find existing conversation (was created when offer was made)
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('product_id', offerData.product.id)
          .or(
            `and(participant_1.eq.${user.id},participant_2.eq.${offerData.product.seller_id}),` +
            `and(participant_1.eq.${offerData.product.seller_id},participant_2.eq.${user.id})`
          )
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv?.id) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: existingConv.id,
              sender_id: user.id,
              content: '🎉 Pedido confirmado! Oferta aceita. Podemos combinar o local e horário para a entrega?',
            });
        }

        if (existingConv?.id) {
          toast({
            title: 'Pedido confirmado! 🎉',
            description: 'Combine a entrega com o vendedor pelo chat.',
          });
          navigate(`/chat/${existingConv.id}`);
        } else {
          toast({
            title: 'Pedido criado!',
            description: 'Acesse "Minhas Compras" para acompanhar.',
          });
          navigate('/my-purchases');
        }
      } catch (orderCreationError) {
        // Rollback reservation
        if (createdOrderId) {
          await supabase.from('order_items').delete().eq('order_id', createdOrderId);
          await supabase.from('orders').delete().eq('id', createdOrderId);
        }

        await supabase.rpc('release_product_reservations', {
          product_ids: [offerData.product.id],
        });
        throw orderCreationError;
      }
    } catch (err) {
      console.error('[Checkout] Error creating offer order:', err);
      toast({
        title: 'Erro ao criar pedido',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Redirect if no seller specified or seller not found
  useEffect(() => {
    if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) {
      navigate('/cart');
    }
  }, [offerId, sellerId, sellerGroup, sellerItems.length, navigate]);

  if (!offerId && (!sellerId || !sellerGroup || sellerItems.length === 0)) {
    return null;
  }

  // Show spinner while loading offer data (also blocks render until offerData is populated)
  if (offerId && (!offerData || offerLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
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
          <h1 className="font-display text-xl font-semibold">
            {offerId ? 'Finalizar Compra' : 'Ordem de Compra'}
          </h1>
          {!offerId && sellerGroup && (
            <p className="text-xs text-muted-foreground">{sellerGroup.sellerName}</p>
          )}
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Delivery Options */}
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Forma de Entrega
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {deliveryOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedDelivery === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => option.available && setSelectedDelivery(option.id)}
                  disabled={!option.available}
                  className={cn(
                    'relative p-4 rounded-xl text-center transition-all',
                    option.available 
                      ? 'cursor-pointer' 
                      : 'cursor-not-allowed opacity-60',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {!option.available && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 text-[10px] bg-muted"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Em breve
                    </Badge>
                  )}
                  <Icon className={cn(
                    'w-8 h-8 mx-auto mb-2',
                    isSelected ? 'text-primary-foreground' : 'text-primary'
                  )} />
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Chat Notice */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Local de entrega via Chat
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Após confirmar o pedido, combine o local e horário de retirada diretamente com o vendedor pelo chat.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coupon Section */}
        {!offerId && (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Cupom de Desconto
            </h2>

            {appliedCoupon ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Tag className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono text-foreground">{appliedCoupon.code}</p>
                  <p className="text-xs text-primary">
                    {appliedCoupon.discount_type === 'percentage'
                      ? `${appliedCoupon.discount_value}% de desconto`
                      : `R$ ${appliedCoupon.discount_value.toFixed(2).replace('.', ',')} de desconto`}
                    {appliedCoupon.applies_to === 'all' ? '' : ' (anúncio específico)'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleRemoveCoupon}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o código do cupom"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError('');
                    }}
                    className="font-mono uppercase"
                    maxLength={20}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  />
                  <Button
                    variant="outline"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="shrink-0"
                  >
                    {couponLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Aplicar'
                    )}
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-destructive">{couponError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-3">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Horário preferido, ponto de referência..."
            className="input-premium min-h-[80px] resize-none"
            maxLength={500}
          />
        </div>

        <Separator />

        {offerId && offerData ? (
          /* Offer mode: single product at negotiated price */
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Produto</h2>
            <div className="rounded-xl bg-card border border-border/50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {offerData.product.images?.[0] ? (
                    <img
                      src={offerData.product.images[0]}
                      alt={offerData.product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{offerData.product.title}</p>
                  {offerData.product.size && (
                    <p className="text-xs text-muted-foreground">
                      Tam. {offerData.product.size}
                      {offerData.product.brand ? ` • ${offerData.product.brand}` : ''}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {offerData.product.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-base font-bold text-primary">
                      R$ {offerData.amount.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vendedor</span>
                <span className="text-sm font-medium">{offerData.sellerName}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Normal cart mode: existing "Resumo do Pedido" block unchanged */
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Resumo do Pedido
            </h2>
            <div className="space-y-2">
              {sellerItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Tam. {item.size}</p>
                  </div>
                  <p className="font-semibold">R$ {item.price}</p>
                </div>
              ))}
            </div>
            {appliedCoupon && discount > 0 && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <span>Desconto ({appliedCoupon.code})</span>
                  <span>- R$ {discount.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">
              R$ {(offerId && offerData ? offerData.amount : totalAmount).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        <Button
          className="w-full btn-primary h-14 text-base"
          onClick={offerId && offerData ? handleConfirmOfferOrder : handleConfirmOrder}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              {offerId && offerData ? 'Confirmar Pedido' : 'Confirmar ordem de compra'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
