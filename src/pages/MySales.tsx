import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Loader2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Check,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

interface OrderItem {
  id: string;
  title: string;
  price: number;
  size: string;
  image: string | null;
}

interface Order {
  id: string;
  status: OrderStatus;
  delivery_method: string;
  delivery_address: string | null;
  delivery_notes: string | null;
  total_price: number;
  created_at: string;
  buyer_id: string;
  order_items: OrderItem[];
  buyer_display_name?: string;
  buyer_phone?: string;
  has_buyer_review: boolean;
}

const statusConfig: Record<OrderStatus, { 
  label: string; 
  icon: typeof Clock; 
  color: string;
  bgColor: string;
}> = {
  pending: { 
    label: 'Aguardando confirmação', 
    icon: Clock, 
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  confirmed: { 
    label: 'Confirmado', 
    icon: Package, 
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  in_transit: { 
    label: 'Em trânsito', 
    icon: Truck, 
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  },
  delivered: { 
    label: 'Entregue', 
    icon: CheckCircle, 
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  cancelled: { 
    label: 'Cancelado', 
    icon: XCircle, 
    color: 'text-destructive',
    bgColor: 'bg-destructive/10'
  },
};

const statusFlow: OrderStatus[] = ['pending', 'confirmed', 'in_transit', 'delivered'];

function getNextStatus(current: OrderStatus): OrderStatus | null {
  const idx = statusFlow.indexOf(current);
  if (idx === -1 || idx >= statusFlow.length - 1) return null;
  return statusFlow[idx + 1];
}

function getNextStatusAction(current: OrderStatus): string | null {
  switch (current) {
    case 'pending': return 'Confirmar pedido';
    case 'confirmed': return 'Marcar como enviado';
    case 'in_transit': return 'Confirmar entrega';
    default: return null;
  }
}

export default function MySales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        // Fetch orders where user is the seller
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            delivery_method,
            delivery_address,
            delivery_notes,
            total_price,
            created_at,
            buyer_id,
            order_items (
              id,
              title,
              price,
              size,
              image
            )
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Fetch buyer names and check if seller already reviewed
        const ordersWithDetails = await Promise.all(
          (ordersData || []).map(async (order) => {
            // Get buyer profile
            const { data: buyerData } = await supabase
              .from('profiles')
              .select('display_name, phone')
              .eq('user_id', order.buyer_id)
              .maybeSingle();

            // Check if seller already reviewed this buyer
            const { data: reviewData } = await supabase
              .from('reviews')
              .select('id')
              .eq('order_id', order.id)
              .eq('review_type', 'seller_to_buyer')
              .maybeSingle();

            return {
              ...order,
              buyer_display_name: buyerData?.display_name || 'Comprador',
              buyer_phone: buyerData?.phone || null,
              has_buyer_review: !!reviewData,
            };
          })
        );

        setOrders(ordersWithDetails);
      } catch (err) {
        console.error('[MySales] Error fetching orders:', err);
        toast({
          title: 'Erro ao carregar vendas',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('seller-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrder(orderId);

    try {
      const updateData: { status: OrderStatus; confirmed_at?: string; delivered_at?: string } = {
        status: newStatus,
      };

      if (newStatus === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('seller_id', user?.id);

      if (error) throw error;

      // Update local state
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));

      const statusLabels: Record<OrderStatus, string> = {
        pending: 'pendente',
        confirmed: 'confirmado',
        in_transit: 'em trânsito',
        delivered: 'entregue',
        cancelled: 'cancelado',
      };

      toast({
        title: 'Status atualizado',
        description: `Pedido marcado como ${statusLabels[newStatus]}.`,
      });
    } catch (err) {
      console.error('[MySales] Error updating order status:', err);
      toast({
        title: 'Erro ao atualizar status',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setUpdatingOrder(orderId);
    setCancelDialog(null);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('seller_id', user?.id);

      if (error) throw error;

      // Update local state
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: 'cancelled' } : o
      ));

      toast({
        title: 'Pedido cancelado',
        description: 'O comprador será notificado.',
      });
    } catch (err) {
      console.error('[MySales] Error cancelling order:', err);
      toast({
        title: 'Erro ao cancelar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleContactBuyer = (buyerId: string) => {
    // Navigate to messages with the buyer
    navigate(`/messages?contact=${buyerId}`);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const activeOrders = orders.filter(o => ['confirmed', 'in_transit'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  const renderOrderCard = (order: Order) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const nextStatus = getNextStatus(order.status);
    const nextAction = getNextStatusAction(order.status);
    const isExpanded = expandedOrder === order.id;
    const isUpdating = updatingOrder === order.id;

    return (
      <Card key={order.id} className="overflow-hidden">
        {/* Header - always visible */}
        <button
          className="w-full p-4 text-left"
          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant="secondary" 
                  className={cn('flex items-center gap-1 text-xs', status.color, status.bgColor)}
                >
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(order.created_at)}
              </p>
              <p className="text-sm font-medium mt-1">
                Comprador: {order.buyer_display_name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="font-bold text-lg">
                R$ {order.total_price.toFixed(2).replace('.', ',')}
              </p>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border/50">
            {/* Items */}
            <div className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Itens do Pedido</p>
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Tam. {item.size}</p>
                  </div>
                  <p className="font-medium text-sm">R$ {item.price}</p>
                </div>
              ))}
            </div>

            {/* Delivery Info */}
            {(order.delivery_address || order.delivery_notes) && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Entrega</p>
                {order.delivery_address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span>{order.delivery_address}</span>
                  </div>
                )}
                {order.delivery_notes && (
                  <p className="text-sm text-muted-foreground italic">
                    "{order.delivery_notes}"
                  </p>
                )}
              </div>
            )}

            {/* Buyer contact */}
            {order.buyer_phone && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{order.buyer_phone}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 border-t border-border/50 space-y-3">
              {/* Status progression */}
              {nextStatus && nextAction && (
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateStatus(order.id, nextStatus);
                  }}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {nextAction}
                </Button>
              )}

              {/* Secondary actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContactBuyer(order.buyer_id);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Mensagem
                </Button>

                {/* Review buyer button */}
                {order.status === 'delivered' && !order.has_buyer_review && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/review/${order.id}?type=seller`);
                    }}
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Avaliar
                  </Button>
                )}
                
                {order.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelDialog(order.id);
                    }}
                    disabled={isUpdating}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
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
            <h1 className="font-display text-xl font-semibold">Minhas Vendas</h1>
          </div>
        </header>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
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
            <h1 className="font-display text-xl font-semibold">Minhas Vendas</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          <div className="card-premium p-8 text-center space-y-3">
            <Store className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium text-foreground">Nenhuma venda ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando alguém comprar seus produtos, os pedidos aparecerão aqui.
              </p>
            </div>
            <Button onClick={() => navigate('/sell')} className="rounded-xl">
              Criar anúncio
            </Button>
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
          <div>
            <h1 className="font-display text-xl font-semibold">Minhas Vendas</h1>
            <p className="text-xs text-muted-foreground">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="pending" className="w-full">
        <div className="px-4 pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="relative">
              Pendentes
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="completed">Finalizados</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="px-4 py-4 space-y-4">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum pedido pendente</p>
            </div>
          ) : (
            pendingOrders.map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="active" className="px-4 py-4 space-y-4">
          {activeOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum pedido em andamento</p>
            </div>
          ) : (
            activeOrders.map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="completed" className="px-4 py-4 space-y-4">
          {completedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum pedido finalizado</p>
            </div>
          ) : (
            completedOrders.map(renderOrderCard)
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O comprador será notificado sobre o cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelDialog && handleCancelOrder(cancelDialog)}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
