import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, User, Tag, CheckCircle, Package, Clock, PackageCheck, Check, CheckCheck, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useOffers, type Offer } from '@/hooks/useOffers';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OfferCard, OfferSheet } from '@/components/chat';
import { ReputationBadge } from '@/components/reputation';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  delivered_at: string | null;
}

interface ConversationDetails {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_user_buyer_reviews_count: number;
  other_user_buyer_reviews_sum: number;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  product_price: number | null;
  is_seller: boolean;
}

interface OrderSummary {
  id: string;
  status: string;
  total_price: number;
  created_at: string;
  items: {
    id: string;
    product_id: string;
    title: string;
    price: number;
    size: string;
    brand: string | null;
    image: string | null;
  }[];
}

// Union type for timeline items
type TimelineItem = 
  | { type: 'message'; data: Message; timestamp: Date }
  | { type: 'offer'; data: Offer; timestamp: Date };

// WhatsApp-style message status component
function MessageStatus({ readAt, deliveredAt }: { readAt: string | null; deliveredAt: string | null }) {
  if (readAt) {
    // Read: 2 blue checks
    return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
  }
  if (deliveredAt) {
    // Delivered: 2 grey checks
    return <CheckCheck className="w-3.5 h-3.5" />;
  }
  // Sent: 1 grey check
  return <Check className="w-3.5 h-3.5" />;
}

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [counterOfferData, setCounterOfferData] = useState<{ parentId: string; previousAmount: number } | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);

  const {
    offers,
    createOffer,
    respondToOffer,
    hasAcceptedOffer,
  } = useOffers(conversationId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversation details and messages
  useEffect(() => {
    if (!conversationId || !user) return;

    const fetchData = async () => {
      try {
        // Fetch conversation with product details
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*, products(id, title, images, price, seller_id)')
          .eq('id', conversationId)
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
          .maybeSingle();

        if (convError) throw convError;

        if (!convData) {
          toast({
            title: 'Conversa não encontrada',
            variant: 'destructive',
          });
          navigate('/messages');
          return;
        }

        // Determine other user
        const otherUserId = convData.participant_1 === user.id 
          ? convData.participant_2 
          : convData.participant_1;

        // Get other user's profile with reputation data
        const { data: profileData } = await supabase
          .from('public_profiles')
          .select('display_name, avatar_url, buyer_reviews_count, buyer_reviews_sum')
          .eq('user_id', otherUserId)
          .maybeSingle();

        const isSeller = convData.products?.seller_id === user.id;

        setConversation({
          id: convData.id,
          other_user_id: otherUserId,
          other_user_name: profileData?.display_name || 'Usuário',
          other_user_avatar: profileData?.avatar_url,
          other_user_buyer_reviews_count: profileData?.buyer_reviews_count || 0,
          other_user_buyer_reviews_sum: profileData?.buyer_reviews_sum || 0,
          product_id: convData.products?.id || null,
          product_title: convData.products?.title || null,
          product_image: convData.products?.images?.[0] || null,
          product_price: convData.products?.price || null,
          is_seller: isSeller,
        });

        // Check for orders related to this product (for both seller and buyer)
        if (convData.products?.id) {
          const { data: orderData } = await supabase
            .from('orders')
            .select(`
              id, status, total_price, created_at,
              order_items(id, product_id, title, price, size, brand, image)
            `)
            .eq('product_id', convData.products.id)
            .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
            .in('status', ['pending', 'confirmed', 'in_transit'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orderData) {
            setOrderSummary({
              id: orderData.id,
              status: orderData.status,
              total_price: orderData.total_price,
              created_at: orderData.created_at,
              items: orderData.order_items || [],
            });

            // Set pending order ID for seller confirmation
            if (isSeller && orderData.status === 'pending') {
              setPendingOrderId(orderData.id);
            }
          }
        }

        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        setMessages(messagesData || []);

        // Mark unread messages as delivered + read (user opened the chat)
        const now = new Date().toISOString();
        await supabase
          .from('messages')
          .update({ read_at: now, delivered_at: now })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .is('read_at', null);

      } catch (err) {
        console.error('[Chat] Error fetching data:', err);
        toast({
          title: 'Erro ao carregar conversa',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [conversationId, user, navigate, toast]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Mark as delivered + read if from other user (we're viewing the chat)
          if (newMsg.sender_id !== user.id) {
            const now = new Date().toISOString();
            supabase
              .from('messages')
              .update({ read_at: now, delivered_at: now })
              .eq('id', newMsg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, delivered_at: updated.delivered_at, read_at: updated.read_at }
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  // Scroll to bottom when messages or offers change
  useEffect(() => {
    scrollToBottom();
  }, [messages, offers, scrollToBottom]);

  // Merge messages and offers into a timeline
  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({
      type: 'message' as const,
      data: m,
      timestamp: new Date(m.created_at),
    })),
    ...offers.map((o) => ({
      type: 'offer' as const,
      data: o,
      timestamp: new Date(o.created_at),
    })),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
        });

      if (error) throw error;

      inputRef.current?.focus();
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
      setNewMessage(content); // Restore message on error
      toast({
        title: 'Erro ao enviar mensagem',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMakeOffer = () => {
    setCounterOfferData(null);
    setOfferSheetOpen(true);
  };

  const handleCounterOffer = (offer: Offer) => {
    setCounterOfferData({
      parentId: offer.id,
      previousAmount: offer.amount,
    });
    setOfferSheetOpen(true);
  };

  const handleSubmitOffer = async (amount: number) => {
    if (!conversation?.product_id) return;

    // Mark previous offer as countered if this is a counter-offer
    if (counterOfferData) {
      await supabase
        .from('offers')
        .update({ status: 'countered' })
        .eq('id', counterOfferData.parentId);
    }

    await createOffer(
      conversation.product_id,
      amount,
      counterOfferData?.parentId
    );
  };

  const handleConfirmOrder = async () => {
    if (!pendingOrderId || confirmingOrder) return;

    setConfirmingOrder(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', pendingOrderId);

      if (error) throw error;

      // Send confirmation message in chat
      if (conversationId && user) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: '✅ Pedido confirmado! Obrigado pela compra.',
          });
      }

      toast({
        title: 'Pedido confirmado! 🎉',
        description: 'O comprador foi notificado.',
      });

      setPendingOrderId(null);
      // Update order summary status
      if (orderSummary) {
        setOrderSummary({ ...orderSummary, status: 'confirmed' });
      }
    } catch (err) {
      console.error('[Chat] Error confirming order:', err);
      toast({
        title: 'Erro ao confirmar pedido',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setConfirmingOrder(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!orderSummary || markingDelivered) return;
    if (!['confirmed', 'in_transit'].includes(orderSummary.status)) return;

    setMarkingDelivered(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', orderSummary.id);

      if (error) throw error;

      // Send delivery confirmation message
      if (conversationId && user) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: '📦 Pedido entregue! Obrigado pela compra.',
          });
      }

      toast({
        title: 'Pedido marcado como entregue! 🎉',
        description: 'O comprador foi notificado.',
      });

      setOrderSummary({ ...orderSummary, status: 'delivered' });
    } catch (err) {
      console.error('[Chat] Error marking as delivered:', err);
      toast({
        title: 'Erro ao marcar como entregue',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setMarkingDelivered(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation) return null;

  // Get the most recently accepted offer (findLast avoids array copy)
  const acceptedOffer = offers.findLast(o => o.status === 'accepted') ?? null;

  const canMakeOffer = conversation.product_id &&
    conversation.product_price &&
    !conversation.is_seller &&
    !acceptedOffer &&
    !orderSummary;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/messages')}
            className="w-10 h-10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              {conversation.product_image ? (
                <img
                  src={conversation.product_image}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              {conversation.other_user_avatar && (
                <img
                  src={conversation.other_user_avatar}
                  alt=""
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card object-cover"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{conversation.other_user_name}</p>
                <ReputationBadge
                  reviewsCount={conversation.other_user_buyer_reviews_count}
                  reviewsSum={conversation.other_user_buyer_reviews_sum}
                  size="sm"
                />
              </div>
              {conversation.product_title && (
                <p className="text-xs text-muted-foreground truncate">
                  {conversation.product_title}
                  {conversation.product_price && ` • R$ ${conversation.product_price.toFixed(2)}`}
                </p>
              )}
            </div>
          </div>

          {/* Make offer button in header (for buyers) */}
          {canMakeOffer && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMakeOffer}
              className="flex-shrink-0"
            >
              <Tag className="w-4 h-4 mr-1" />
              Oferta
            </Button>
          )}
        </div>
      </header>

      {/* Pending order banner for seller */}
      {conversation.is_seller && pendingOrderId && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Pedido aguardando confirmação
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80 truncate">
                  Confirme para notificar o comprador
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleConfirmOrder}
              disabled={confirmingOrder}
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {confirmingOrder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirmar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Accepted offer banner */}
      {acceptedOffer && !orderSummary && (
        <>
          {!conversation.is_seller ? (
            // Buyer view: show checkout button
            <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    ✓ Oferta aceita!
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80">
                    Por R$ {acceptedOffer.amount.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate(`/checkout?offerId=${acceptedOffer.id}`)}
                  className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Comprar por R$ {acceptedOffer.amount.toFixed(2).replace('.', ',')}
                </Button>
              </div>
            </div>
          ) : (
            // Seller view: waiting message
            <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
              <p className="text-sm text-primary text-center font-medium">
                ✓ Oferta aceita! Aguardando o comprador finalizar a compra.
              </p>
            </div>
          )}
        </>
      )}

      {/* Order Summary Card */}
      {orderSummary && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Resumo do Pedido</span>
            <Badge 
              variant={orderSummary.status === 'pending' ? 'secondary' : 'default'}
              className="ml-auto text-xs"
            >
              {orderSummary.status === 'pending' && (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  Aguardando confirmação
                </>
              )}
              {orderSummary.status === 'confirmed' && '✓ Confirmado'}
              {orderSummary.status === 'in_transit' && '🚚 Em trânsito'}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {orderSummary.items.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                onClick={() => navigate(`/product/${item.product_id}`)}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Tam. {item.size} {item.brand && `• ${item.brand}`}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  R$ {item.price.toFixed(2).replace('.', ',')}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-base font-bold">
              R$ {orderSummary.total_price.toFixed(2).replace('.', ',')}
            </span>
          </div>

          {/* Mark as delivered button for seller */}
          {conversation.is_seller && ['confirmed', 'in_transit'].includes(orderSummary.status) && (
            <Button
              onClick={handleMarkDelivered}
              disabled={markingDelivered}
              className="w-full mt-3 btn-primary"
            >
              {markingDelivered ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4 mr-2" />
              )}
              Marcar como entregue
            </Button>
          )}

          {/* Delivered status */}
          {orderSummary.status === 'delivered' && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-2 text-primary">
              <PackageCheck className="w-4 h-4" />
              <span className="text-sm font-medium">Pedido entregue</span>
            </div>
          )}
        </div>
      )}

      {/* Messages and Offers Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {timeline.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">
              Comece a conversa enviando uma mensagem
            </p>
            {canMakeOffer && (
              <Button
                variant="link"
                onClick={handleMakeOffer}
                className="mt-2 text-primary"
              >
                <Tag className="w-4 h-4 mr-1" />
                Ou faça uma oferta
              </Button>
            )}
          </div>
        ) : (
          timeline.map((item) => {
            if (item.type === 'message') {
              const message = item.data;
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={`msg-${message.id}`}
                  className={cn(
                    'flex',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] px-4 py-2 rounded-2xl',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <div
                      className={cn(
                        'flex items-center gap-1 mt-1 justify-end',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      <span className="text-[10px]">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                      {isOwn && (
                        <MessageStatus
                          readAt={message.read_at}
                          deliveredAt={message.delivered_at}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              const offer = item.data;
              const isOwn = offer.sender_id === user?.id;
              return (
                <div
                  key={`offer-${offer.id}`}
                  className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                >
                  <OfferCard
                    offer={offer}
                    isOwn={isOwn}
                    productPrice={conversation.product_price || 0}
                    onAccept={() => respondToOffer(offer.id, true)}
                    onReject={() => respondToOffer(offer.id, false)}
                    onCounter={() => handleCounterOffer(offer)}
                  />
                </div>
              );
            }
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 glass-effect border-t border-border/30 p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="flex-1 input-premium"
            maxLength={1000}
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className="btn-primary w-12 h-12"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Offer Sheet */}
      {conversation.product_id && conversation.product_price && (
        <OfferSheet
          open={offerSheetOpen}
          onOpenChange={setOfferSheetOpen}
          productTitle={conversation.product_title || 'Produto'}
          productPrice={conversation.product_price}
          productImage={conversation.product_image}
          isCounterOffer={!!counterOfferData}
          previousAmount={counterOfferData?.previousAmount}
          onSubmit={handleSubmitOffer}
        />
      )}
    </div>
  );
}
