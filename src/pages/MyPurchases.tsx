import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface OrderItem {
  id: string;
  title: string;
  price: number;
  size: string;
  image: string;
}

interface Order {
  id: string;
  status: string;
  delivery_method: string;
  total_price: number;
  created_at: string;
  delivered_at: string | null;
  seller_id: string;
  order_items: OrderItem[];
  seller_display_name?: string;
  has_review: boolean;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: 'Aguardando', icon: Clock, color: 'text-yellow-500' },
  confirmed: { label: 'Confirmado', icon: Package, color: 'text-blue-500' },
  in_transit: { label: 'Em trânsito', icon: Truck, color: 'text-primary' },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'text-green-500' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'text-destructive' },
};

export default function MyPurchases() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        // Fetch orders with items
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            delivery_method,
            total_price,
            created_at,
            delivered_at,
            seller_id,
            order_items (
              id,
              title,
              price,
              size,
              image
            )
          `)
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Fetch seller names and reviews
        const ordersWithDetails = await Promise.all(
          (ordersData || []).map(async (order) => {
            // Get seller name
            const { data: sellerData } = await supabase
              .from('public_profiles')
              .select('display_name')
              .eq('user_id', order.seller_id)
              .maybeSingle();

            // Check if buyer already reviewed this order
            const { data: reviewData } = await supabase
              .from('reviews')
              .select('id')
              .eq('order_id', order.id)
              .eq('review_type', 'buyer_to_seller')
              .maybeSingle();

            return {
              ...order,
              seller_display_name: sellerData?.display_name || 'Vendedor',
              has_review: !!reviewData,
            };
          })
        );

        setOrders(ordersWithDetails);
      } catch (err) {
        console.error('[MyPurchases] Error fetching orders:', err);
        toast({
          title: 'Erro ao carregar compras',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, toast]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
            <h1 className="font-display text-xl font-semibold">Minhas Compras</h1>
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
            <h1 className="font-display text-xl font-semibold">Minhas Compras</h1>
          </div>
        </header>

        <div className="px-4 py-6">
          <Card className="p-8 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma compra ainda</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Quando você fizer uma compra, ela aparecerá aqui.
            </p>
            <Button onClick={() => navigate('/')}>
              Explorar peças
            </Button>
          </Card>
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
            <h1 className="font-display text-xl font-semibold">Minhas Compras</h1>
            <p className="text-xs text-muted-foreground">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {orders.map((order) => {
          const status = statusConfig[order.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          
          return (
            <Card key={order.id} className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Pedido de {formatDate(order.created_at)}
                  </p>
                  <p className="text-sm font-medium mt-1">
                    Vendedor: {order.seller_display_name}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn('flex items-center gap-1', status.color)}
                >
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </Badge>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted">
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
                      <p className="text-xs text-muted-foreground">
                        Tam. {item.size}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">R$ {item.price}</p>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold">
                    R$ {order.total_price.toFixed(2).replace('.', ',')}
                  </p>
                </div>

                {order.status === 'delivered' && !order.has_review && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate(`/review/${order.id}`)}
                  >
                    <Star className="w-4 h-4 mr-1" />
                    Avaliar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
