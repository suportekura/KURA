import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/hooks/useFavorites';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { staggerContainer, staggerItem } from '@/lib/animations';

export default function Favorites() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { favorites, isLoading: favoritesLoading, removeFavorite } = useFavorites();
  const { addItem, isInCart } = useCart();

  // Get product IDs from favorites
  const productIds = favorites.map((fav) => fav.productId);

  // Fetch products for favorites
  const { data: products = [], isLoading: productsLoading } = useProducts({
    limit: 50,
  });

  // Filter products that are in favorites
  const favoriteProducts = products.filter((product) =>
    productIds.includes(product.id)
  );

  const isLoading = favoritesLoading || productsLoading;

  const handleRemoveFavorite = (productId: string, productTitle: string) => {
    removeFavorite(productId);
    toast({
      title: 'Removido dos favoritos',
      description: productTitle,
    });
  };

  const handleAddToCart = (product: typeof favoriteProducts[0]) => {
    addItem({
      productId: product.id,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      size: product.size,
      brand: product.brand,
      image: product.images[0] || 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800',
      sellerId: product.sellerId,
      sellerName: product.sellerDisplayName || 'Vendedor',
      sellerAvatar: product.sellerAvatarUrl,
    });

    toast({
      title: 'Adicionado ao carrinho',
      description: product.title,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
            <h1 className="font-display text-xl font-semibold">Favoritos</h1>
          </div>
        </header>

        {/* Loading Skeleton */}
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-24 h-24 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen bg-background">
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
            <h1 className="font-display text-xl font-semibold">Favoritos</h1>
          </div>
        </header>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            Nenhum favorito ainda
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            Explore peças e toque no coração para salvar seus favoritos
          </p>
          <Button asChild className="btn-primary">
            <Link to="/">
              Explorar peças
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
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
              <h1 className="font-display text-xl font-semibold">Favoritos</h1>
              <p className="text-xs text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? 'peça' : 'peças'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Favorites List */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="px-4 py-4 space-y-3"
      >
        {favoriteProducts.map((product) => {
          const productInCart = isInCart(product.id);
          const discount = product.originalPrice
            ? Math.round((1 - product.price / product.originalPrice) * 100)
            : 0;

          return (
            <motion.div key={product.id} variants={staggerItem} className="card-premium p-3 flex gap-3">
              {/* Product Image */}
              <Link to={`/product/${product.id}`} className="flex-shrink-0">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted relative">
                  <img
                    src={product.images[0] || 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800'}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  {discount > 0 && (
                    <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0.5">
                      -{discount}%
                    </Badge>
                  )}
                </div>
              </Link>

              {/* Product Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <Link to={`/product/${product.id}`}>
                    <h3 className="font-medium text-foreground text-sm line-clamp-2 hover:underline">
                      {product.title}
                    </h3>
                  </Link>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {product.brand}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      Tam. {product.size}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-foreground">
                      R$ {product.price}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        R$ {product.originalPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFavorite(product.id, product.title)}
                  className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAddToCart(product)}
                  disabled={productInCart}
                  className={`w-8 h-8 ${productInCart ? 'text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
