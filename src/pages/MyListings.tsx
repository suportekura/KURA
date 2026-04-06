import { useState, useEffect, useMemo } from 'react';
import { Plus, Package, MoreVertical, Edit, Trash2, Eye, EyeOff, ArrowLeft, Clock, XCircle, RefreshCw, Zap, ChevronRight, Users, Flame } from 'lucide-react';
import { formatViewCount } from '@/hooks/useProductViews';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSellerQueueCounts } from '@/hooks/useProductQueue';
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
import { QueueViewSheet } from '@/components/seller/QueueViewSheet';
import { BoostSelectionModal } from '@/components/boost/BoostSelectionModal';
interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: string;
  created_at: string;
  condition: string;
  moderation_status?: string | null;
  review_notes?: string | null;
  view_count: number;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon?: React.ReactNode }> = {
  active: { label: 'Ativo', variant: 'default' },
  draft: { label: 'Rascunho', variant: 'secondary' },
  sold: { label: 'Vendido', variant: 'outline' },
  reserved: { label: 'Em negociação', variant: 'default', icon: <Users className="h-3 w-3 mr-1" /> },
  inactive: { label: 'Inativo', variant: 'destructive' },
  pending_review: { label: 'Em revisão', variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
};

const moderationLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon?: React.ReactNode }> = {
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
};

export default function MyListings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedRejectionNotes, setSelectedRejectionNotes] = useState<string | null>(null);
  const [queueSheetProduct, setQueueSheetProduct] = useState<{ id: string; title: string } | null>(null);
  const [boostedProductIds, setBoostedProductIds] = useState<Set<string>>(new Set());
  const [boostModalProduct, setBoostModalProduct] = useState<{ id: string; title: string } | null>(null);
  const [boostCredits, setBoostCredits] = useState<{ '24h': number; '3d': number; '7d': number } | null>(null);

  // Get queue counts for reserved products
  const reservedProductIds = useMemo(
    () => products.filter(p => p.status === 'reserved').map(p => p.id),
    [products]
  );
  const { counts: queueCounts } = useSellerQueueCounts(reservedProductIds);

  // Fetch active boosts and credits
  useEffect(() => {
    if (!user) return;
    const fetchBoostsAndCredits = async () => {
      const [{ data: boosts }, { data: credits }] = await Promise.all([
        supabase
          .from('product_boosts')
          .select('product_id')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString()),
        supabase
          .from('user_boosts')
          .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (boosts) {
        setBoostedProductIds(new Set(boosts.map(b => b.product_id)));
      }
      if (credits) {
        setBoostCredits({
          '24h': credits.total_boosts_24h - credits.used_boosts_24h,
          '3d': credits.total_boosts_3d - credits.used_boosts_3d,
          '7d': credits.total_boosts_7d - credits.used_boosts_7d,
        });
      } else {
        setBoostCredits({ '24h': 0, '3d': 0, '7d': 0 });
      }
    };
    fetchBoostsAndCredits();
  }, [user, products]);

  useEffect(() => {
    if (!user) return;

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, images, status, created_at, condition, moderation_status, review_notes, view_count')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Erro ao carregar anúncios',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [user, toast]);

  const handleStatusChange = async (productId: string, newStatus: 'active' | 'inactive') => {
    const { error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', productId)
      .eq('seller_id', user?.id);

    if (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setProducts(products.map(p => 
        p.id === productId ? { ...p, status: newStatus } : p
      ));
      toast({
        title: 'Status atualizado',
        description: `Anúncio marcado como ${statusLabels[newStatus]?.label || newStatus}`,
      });
    }
  };

  const handleDelete = async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('seller_id', user?.id);

    if (error) {
      toast({
        title: 'Erro ao excluir anúncio',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setProducts(products.filter(p => p.id !== productId));
      toast({
        title: 'Anúncio excluído',
        description: 'O anúncio foi removido com sucesso.',
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
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
            <h1 className="font-display text-xl font-semibold">Meus Anúncios</h1>
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

  if (products.length === 0) {
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
            <h1 className="font-display text-xl font-semibold">Meus Anúncios</h1>
          </div>
        </header>
        <div className="px-4 py-6">
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhum anúncio ainda</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Comece a vender suas peças agora mesmo!
            </p>
            <Button onClick={() => navigate('/sell')}>
              <Plus className="w-4 h-4 mr-2" />
              Criar anúncio
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-semibold">Meus Anúncios</h1>
              <p className="text-xs text-muted-foreground">
                {products.length} {products.length === 1 ? 'anúncio' : 'anúncios'}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/sell')}>
            <Plus className="w-4 h-4 mr-2" />
            Criar anúncio
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {/* Boost Nudge */}
        <div
          className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 cursor-pointer group transition-all hover:border-primary/25"
          onClick={() => navigate('/boosts')}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-[18px] h-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">
                Destaque seus anúncios
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Produtos impulsionados recebem até 5x mais visualizações e vendem mais rápido.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
          </div>
        </div>

        {products.map((product) => (
          <Card key={product.id} className="p-4">
            <div className="flex gap-4">
              <div 
                className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 
                      className="font-medium truncate cursor-pointer hover:text-primary"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      {product.title}
                    </h3>
                    <p className="text-lg font-semibold text-primary">
                      {formatPrice(product.price)}
                    </p>
                    <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span className="text-[11px]">{formatViewCount(product.view_count)} visualizações</span>
                      </div>
                      {product.status === 'reserved' && (queueCounts[product.id] || 0) > 0 && (
                        <button
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQueueSheetProduct({ id: product.id, title: product.title });
                          }}
                        >
                          <Flame className="w-3 h-3" />
                          <span className="text-[11px] font-medium">{queueCounts[product.id]} na fila</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/product/${product.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/sell?edit=${product.id}`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {product.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'inactive')}>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                      ) : product.status !== 'sold' && product.status !== 'pending_review' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(product.id, 'active')}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ativar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleDelete(product.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant={statusLabels[product.status]?.variant || 'secondary'} className="flex items-center">
                    {statusLabels[product.status]?.icon}
                    {statusLabels[product.status]?.label || product.status}
                  </Badge>
                  {product.moderation_status === 'rejected' && (
                    <Badge 
                      variant="destructive" 
                      className="flex items-center cursor-pointer hover:bg-destructive/90"
                      onClick={() => {
                        setSelectedRejectionNotes(product.review_notes || 'Motivo não especificado');
                        setRejectionDialogOpen(true);
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Rejeitado
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {product.condition === 'novo' ? 'Novo' : 'Usado'}
                  </Badge>
                </div>

                {/* Boost button for active products */}
                {product.status === 'active' && (
                  boostedProductIds.has(product.id) ? (
                    <div className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                      <Zap className="w-4 h-4 fill-current" />
                      Impulsionado
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => setBoostModalProduct({ id: product.id, title: product.title })}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Impulsionar
                    </Button>
                  )
                )}

                {/* Show resubmit button for rejected products */}
                {product.moderation_status === 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full text-primary border-primary hover:bg-primary/10"
                    onClick={() => navigate(`/sell?edit=${product.id}`)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Editar e reenviar para análise
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Queue View Sheet */}
      <QueueViewSheet
        open={!!queueSheetProduct}
        onOpenChange={(open) => !open && setQueueSheetProduct(null)}
        productId={queueSheetProduct?.id || ''}
        productTitle={queueSheetProduct?.title || ''}
      />

      {/* Boost Selection Modal */}
      <BoostSelectionModal
        open={!!boostModalProduct}
        onOpenChange={(open) => !open && setBoostModalProduct(null)}
        product={boostModalProduct}
        credits={boostCredits}
        onBoostActivated={() => {
          setBoostModalProduct(null);
          // Refresh boosts
          if (user) {
            supabase
              .from('product_boosts')
              .select('product_id')
              .eq('user_id', user.id)
              .gt('expires_at', new Date().toISOString())
              .then(({ data }) => {
                if (data) setBoostedProductIds(new Set(data.map(b => b.product_id)));
              });
            supabase
              .from('user_boosts')
              .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
              .eq('user_id', user.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data) {
                  setBoostCredits({
                    '24h': data.total_boosts_24h - data.used_boosts_24h,
                    '3d': data.total_boosts_3d - data.used_boosts_3d,
                    '7d': data.total_boosts_7d - data.used_boosts_7d,
                  });
                }
              });
          }
        }}
      />

      {/* Rejection Notes Dialog */}
      <AlertDialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Motivo da rejeição
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {selectedRejectionNotes}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setRejectionDialogOpen(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
