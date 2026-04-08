import { useState, useEffect } from 'react';
import defaultSellerAvatar from '@/assets/default-seller-avatar.png';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, MessageCircle, ShoppingCart, CreditCard, Package, Bike, Clock, Check, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { SellerCard } from '@/components/seller/SellerCard';
import { useProduct } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useConversation } from '@/hooks/useConversation';
import { useToast } from '@/hooks/use-toast';
import { useRecordProductView } from '@/hooks/useProductViews';
import { useProductQueue } from '@/hooks/useProductQueue';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const conditionLabels = {
  novo: 'Novo com etiqueta',
  pouco_usado: 'Pouco usado',
  usado: 'Usado',
};

const deliveryOptions = [
  { icon: Package, label: 'Retirada', description: 'Combinar local', available: true },
  { icon: Bike, label: 'Entrega Local', description: 'Motoboy', available: false, comingSoon: true },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [heartAnimating, setHeartAnimating] = useState(false);
  
  const { addItem, isInCart } = useCart();
  const { isFavorited, toggleFavorite, isToggling } = useFavorites();
  const { startConversation } = useConversation();
  const productInCart = id ? isInCart(id) : false;
  const isProductFavorited = id ? isFavorited(id) : false;
  const [startingChat, setStartingChat] = useState(false);

  // Fetch real product from database
  const { data: realProduct, isLoading } = useProduct(id);

  // Queue support
  const productStatus = realProduct?.status;
  const isReserved = productStatus === 'reserved';
  const isSeller = user?.id === realProduct?.sellerId;
  const { queueCount, userPosition, userInQueue, userIsPromoted, minutesRemaining, joinQueue, isJoining, leaveQueue, isLeaving } = useProductQueue(id, productStatus);

  // Record product view (deduped, excludes seller)
  useRecordProductView(id);
  
  // Convert to display format
  const product = realProduct ? {
    id: realProduct.id,
    title: realProduct.title,
    description: realProduct.description,
    price: realProduct.price,
    originalPrice: realProduct.originalPrice,
    size: realProduct.size,
    brand: realProduct.brand,
    category: realProduct.category,
    condition: realProduct.condition,
    images: realProduct.images.length > 0 ? realProduct.images : ['https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800'],
    sellerId: realProduct.sellerId,
    sellerName: realProduct.sellerDisplayName || 'Vendedor',
    sellerAvatar: realProduct.sellerAvatarUrl || defaultSellerAvatar,
    sellerReviewsCount: 0,
    sellerReviewsSum: 0,
    distance: realProduct.distance,
    city: realProduct.sellerCity || 'Localização desconhecida',
    createdAt: realProduct.createdAt,
    status: realProduct.status,
  } : null;

  const handleJoinQueue = async () => {
    try {
      await joinQueue();
      toast({
        title: 'Você entrou na fila! 🎉',
        description: 'Você será notificado quando for sua vez.',
      });
    } catch (error) {
      toast({
        title: 'Não foi possível entrar na fila',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleLeaveQueue = async () => {
    try {
      await leaveQueue();
      toast({
        title: 'Você saiu da fila',
        description: 'Você pode entrar novamente a qualquer momento.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao sair da fila',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    addItem({
      productId: product.id,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      size: product.size,
      brand: product.brand,
      image: product.images[0],
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      sellerAvatar: product.sellerAvatar,
    });

    toast({
      title: 'Adicionado ao carrinho',
      description: product.title,
    });
  };

  const handleShare = async () => {
    if (!product) return;
    
    const shareData = {
      title: product.title,
      text: `Confira ${product.title} por R$ ${product.price} na Kura!`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: 'Link copiado!',
          description: 'O link do produto foi copiado para a área de transferência.',
        });
      }
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: 'Link copiado!',
          description: 'O link do produto foi copiado para a área de transferência.',
        });
      }
    }
  };

  const handleToggleFavorite = async () => {
    if (!id) return;
    const nowFavorited = await toggleFavorite(id);
    if (nowFavorited) {
      setHeartAnimating(true);
    }
  };

  // Reset heart animation after it completes
  useEffect(() => {
    if (heartAnimating) {
      const timer = setTimeout(() => setHeartAnimating(false), 600);
      return () => clearTimeout(timer);
    }
  }, [heartAnimating]);

  const handleBuyNow = () => {
    if (!product) return;
    if (!productInCart) {
      addItem({
        productId: product.id,
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        size: product.size,
        brand: product.brand,
        image: product.images[0],
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        sellerAvatar: product.sellerAvatar,
      });
    }
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <Skeleton className="aspect-[4/5] rounded-2xl" />
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Produto não encontrado</p>
      </div>
    );
  }

  const discount = product.originalPrice 
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const distanceDisplay = product.distance !== null && product.distance !== undefined && product.distance > 0
    ? `${product.distance} km de você`
    : product.city || 'Localização desconhecida';

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Desktop Layout Container */}
      <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
          {/* Image Section */}
          <div className="relative lg:sticky lg:top-8">
            <ProductImageGallery images={product.images} productTitle={product.title} />

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFavorite}
                  disabled={isToggling}
                  className={cn(
                    'w-10 h-10 rounded-full backdrop-blur-sm transition-colors',
                    isProductFavorited ? 'bg-primary text-primary-foreground' : 'bg-background/80'
                  )}
                >
                  {isToggling ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Heart className={cn(
                      'w-5 h-5 transition-transform',
                      isProductFavorited && 'fill-current',
                      heartAnimating && 'animate-heart-pulse'
                    )} />
                  )}
                </Button>
              </div>
            </div>

            {/* Discount Badge */}
            {discount > 0 && (
              <Badge className="absolute bottom-4 left-4 bg-primary text-primary-foreground border-0 text-sm px-3 py-1 z-10">
                -{discount}%
              </Badge>
            )}

            {/* Em negociação Badge */}
            {isReserved && (
              <Badge className="absolute bottom-4 right-4 bg-primary/90 text-primary-foreground border-0 text-sm px-3 py-1 z-10">
                Em negociação
              </Badge>
            )}
          </div>

          {/* Content Section */}
          <div className="px-4 py-6 space-y-6 lg:px-0 lg:py-0">
            {/* Title and Price */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
                  {product.title}
                </h1>
              </div>
              
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">
                  R$ {product.price}
                </span>
                {product.originalPrice && (
                  <span className="text-lg text-muted-foreground line-through">
                    R$ {product.originalPrice}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-lg">
                  {product.brand}
                </Badge>
                <Badge variant="secondary" className="rounded-lg">
                  Tam. {product.size}
                </Badge>
                <Badge variant="secondary" className="rounded-lg">
                  {conditionLabels[product.condition]}
                </Badge>
              </div>
            </div>

            {/* Seller Info */}
            <SellerCard
              sellerId={product.sellerId}
              displayName={product.sellerName}
              avatarUrl={product.sellerAvatar}
              sellerReviewsCount={product.sellerReviewsCount}
              sellerReviewsSum={product.sellerReviewsSum}
            />

            {/* Description */}
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold text-foreground">Descrição</h2>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Delivery Options */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-foreground">Opções de entrega</h2>
              <div className="grid grid-cols-2 gap-3">
                {deliveryOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div 
                      key={option.label}
                      className={cn(
                        "relative card-premium p-3 text-center space-y-2",
                        !option.available && "opacity-60"
                      )}
                    >
                      {option.comingSoon && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-2 -right-2 text-[10px] bg-muted"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Em breve
                        </Badge>
                      )}
                      <Icon className="w-6 h-6 mx-auto text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{option.label}</p>
                        <p className="text-[10px] text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 glass-effect border-t border-border/30 lg:max-w-6xl lg:mx-auto lg:left-1/2 lg:-translate-x-1/2">
        {isReserved && !isSeller ? (
          <div className="flex gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="w-14 h-14 rounded-xl border-primary text-primary hover:bg-primary/5 flex-shrink-0"
                  onClick={async () => {
                    if (!product?.sellerId) return;
                    setStartingChat(true);
                    await startConversation(product.sellerId, product.id, `Olá! Tenho interesse no produto "${product.title}". Ainda está disponível?`);
                    setStartingChat(false);
                  }}
                  disabled={startingChat}
                >
                  {startingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Conversar com vendedor</p></TooltipContent>
            </Tooltip>

            {userIsPromoted ? (
              <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎉</span>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Sua vez chegou!
                  </p>
                </div>
                <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80 mb-3">
                  Você tem {minutesRemaining ?? 0} min para finalizar a compra.
                </p>
                <Button
                  className="w-full btn-primary h-12"
                  onClick={handleBuyNow}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Comprar agora
                </Button>
              </div>
            ) : userInQueue ? (
              <div className="flex-1 flex flex-col items-center gap-1">
                <Button className="w-full h-14 rounded-xl bg-muted text-muted-foreground cursor-default" disabled>
                  <Users className="w-5 h-5 mr-2" />
                  Você está na fila · Posição #{userPosition}
                </Button>
                <button
                  onClick={handleLeaveQueue}
                  disabled={isLeaving}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  {isLeaving ? 'Saindo...' : 'Sair da fila'}
                </button>
              </div>
            ) : (
              <Button className="flex-1 btn-primary h-14 rounded-xl" onClick={handleJoinQueue} disabled={isJoining}>
                {isJoining ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Users className="w-5 h-5 mr-2" />}
                Entrar na fila
              </Button>
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="w-14 h-14 rounded-xl border-primary text-primary hover:bg-primary/5 flex-shrink-0"
                  onClick={async () => {
                    if (!product?.sellerId) return;
                    setStartingChat(true);
                    await startConversation(product.sellerId, product.id, `Olá! Tenho interesse no produto "${product.title}". Ainda está disponível?`);
                    setStartingChat(false);
                  }}
                  disabled={startingChat}
                >
                  {startingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Conversar com vendedor</p></TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" size="icon"
                  className={cn("w-14 h-14 rounded-xl flex-shrink-0", productInCart ? "bg-muted text-muted-foreground border-muted cursor-default" : "border-primary text-primary hover:bg-primary/5")}
                  onClick={handleAddToCart} disabled={productInCart}
                >
                  {productInCart ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>{productInCart ? 'Já está no carrinho' : 'Adicionar ao carrinho'}</p></TooltipContent>
            </Tooltip>
            
            <Button
              className="flex-1 btn-primary h-14 rounded-xl"
              onClick={handleBuyNow}
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Comprar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
