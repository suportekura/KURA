import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Clock, 
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface PendingProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  brand: string;
  size: string;
  category: string;
  condition: string;
  created_at: string;
  seller_id: string;
  seller_city: string | null;
  seller_state: string | null;
  moderation_status: string | null;
  moderation_notes: string | null;
  moderation_reason: string | null;
}

export default function ModerationQueue() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchPendingProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ModerationQueue] Error fetching products:', error);
        toast({
          title: 'Erro ao carregar fila',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setProducts((data as PendingProduct[]) || []);
      }
    } catch (err) {
      console.error('[ModerationQueue] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const handleApprove = async () => {
    if (!selectedProduct || !user) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          status: 'active',
          moderation_status: 'approved',
          moderation_notes: reviewNotes || null,
          moderated_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Send notification to seller
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedProduct.seller_id,
          type: 'moderation',
          title: 'Anúncio aprovado! 🎉',
          body: `Seu anúncio "${selectedProduct.title}" foi aprovado e já está visível para compradores.`,
          data: { product_id: selectedProduct.id, action: 'approved' },
        });

      if (notifyError) {
        console.error('[ModerationQueue] Error sending approval notification:', notifyError);
      }

      toast({
        title: 'Anúncio aprovado ✓',
        description: 'O produto foi publicado e o vendedor notificado.',
      });

      setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
      setSelectedProduct(null);
      setReviewNotes('');
      setShowApproveDialog(false);
    } catch (err: any) {
      console.error('[ModerationQueue] Error approving:', err);
      toast({
        title: 'Erro ao aprovar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProduct || !user) return;
    
    if (!reviewNotes.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por favor, informe o motivo da rejeição.',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          status: 'inactive',
          moderation_status: 'rejected',
          moderation_notes: reviewNotes,
          moderated_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      // Send notification to seller with rejection reason
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedProduct.seller_id,
          type: 'moderation',
          title: 'Anúncio não aprovado',
          body: `Seu anúncio "${selectedProduct.title}" não foi aprovado. Motivo: ${reviewNotes}`,
          data: { product_id: selectedProduct.id, action: 'rejected', reason: reviewNotes },
        });

      if (notifyError) {
        console.error('[ModerationQueue] Error sending rejection notification:', notifyError);
      }

      toast({
        title: 'Anúncio rejeitado',
        description: 'O vendedor foi notificado.',
      });

      setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
      setSelectedProduct(null);
      setReviewNotes('');
      setShowRejectDialog(false);
    } catch (err: any) {
      console.error('[ModerationQueue] Error rejecting:', err);
      toast({
        title: 'Erro ao rejeitar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-semibold">Fila de Moderação</h1>
              <p className="text-xs text-muted-foreground">Carregando...</p>
            </div>
          </div>
        </header>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="w-24 h-24 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display text-xl font-semibold">Fila de Moderação</h1>
              <p className="text-xs text-muted-foreground">
                {products.length} {products.length === 1 ? 'anúncio pendente' : 'anúncios pendentes'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchPendingProducts}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h3 className="font-semibold text-lg mb-2">Fila vazia!</h3>
              <p className="text-muted-foreground">
                Não há anúncios aguardando revisão.
              </p>
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setSelectedProduct(product);
                setCurrentImageIndex(0);
                setReviewNotes('');
              }}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
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
                    <h3 className="font-medium truncate">{product.title}</h3>
                    <p className="text-lg font-semibold text-primary">
                      {formatPrice(product.price)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(product.created_at)}</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      <Badge variant="secondary" className="w-fit">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Revisão pendente
                      </Badge>
                      {product.moderation_reason && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 line-clamp-2">
                          {product.moderation_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Product Review Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Revisar Anúncio</DialogTitle>
                <DialogDescription>
                  Analise o conteúdo e decida se deve ser aprovado ou rejeitado.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image Gallery */}
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  {selectedProduct.images?.[currentImageIndex] ? (
                    <img
                      src={selectedProduct.images[currentImageIndex]}
                      alt={`Imagem ${currentImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {selectedProduct.images.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(prev => 
                            prev === 0 ? selectedProduct.images.length - 1 : prev - 1
                          );
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(prev => 
                            prev === selectedProduct.images.length - 1 ? 0 : prev + 1
                          );
                        }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 rounded text-xs text-white">
                        {currentImageIndex + 1} / {selectedProduct.images.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Product Info */}
                <div className="space-y-3">
                  {selectedProduct.moderation_reason && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                            Motivo do envio para revisão (IA)
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {selectedProduct.moderation_reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-muted-foreground text-xs">Título</Label>
                    <p className="font-medium">{selectedProduct.title}</p>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground text-xs">Descrição</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedProduct.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground text-xs">Preço</Label>
                      <p className="font-semibold text-primary">{formatPrice(selectedProduct.price)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Marca</Label>
                      <p>{selectedProduct.brand}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Tamanho</Label>
                      <p>{selectedProduct.size}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Condição</Label>
                      <p>{selectedProduct.condition === 'novo' ? 'Novo' : 'Usado'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Localização</Label>
                      <p>{selectedProduct.seller_city}, {selectedProduct.seller_state}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Data de envio</Label>
                      <p className="text-sm">{formatDate(selectedProduct.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Review Notes */}
                <div>
                  <Label htmlFor="review-notes">Notas da revisão (opcional para aprovação)</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Adicione notas sobre a decisão..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={processing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  disabled={processing}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aprovar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar anúncio?</AlertDialogTitle>
            <AlertDialogDescription>
              O anúncio será publicado e ficará visível para todos os usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing}>
              {processing ? 'Aprovando...' : 'Aprovar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar anúncio?</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewNotes.trim() 
                ? 'O anúncio será marcado como inativo e o vendedor será notificado com o motivo informado.'
                : 'Por favor, volte e adicione o motivo da rejeição nas notas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject} 
              disabled={processing || !reviewNotes.trim()}
            >
              {processing ? 'Rejeitando...' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
