import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ShoppingBag, Package, Store, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCart } from '@/contexts/CartContext';
import { useCartProductStatus } from '@/hooks/useCartProductStatus';
import { SoldOverlay } from '@/components/cart';
import { cn } from '@/lib/utils';

export default function Cart() {
  const navigate = useNavigate();
  const { items, itemCount, totalAmount, groupedBySeller, removeItem, removeUnavailableItems, clearCart } = useCart();
  const { isProductSold, hasSoldItems, availableItemsCount, unavailableProductIds, loading } = useCartProductStatus();

  // Calculate totals excluding sold items
  const availableTotalAmount = items
    .filter((item) => !isProductSold(item.productId))
    .reduce((acc, item) => acc + item.price * item.quantity, 0);

  const BackToMenuButton = () => (
    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full" asChild>
      <Link to="/" replace aria-label="Voltar ao menu">
        <ArrowLeft className="w-5 h-5" />
      </Link>
    </Button>
  );

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <BackToMenuButton />
            <h1 className="font-display text-xl font-semibold">Carrinho</h1>
          </div>
        </header>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            Seu carrinho está vazio
          </h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            Explore peças únicas de vendedores próximos a você e adicione ao carrinho
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
    <div className="min-h-screen bg-background pb-36">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BackToMenuButton />
            <div>
              <h1 className="font-display text-xl font-semibold">Carrinho</h1>
              <p className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? 'item' : 'itens'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>
      </header>

      {/* Sold Items Alert */}
      {hasSoldItems && (
        <div className="px-4 pt-4 space-y-3">
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Alguns itens do seu carrinho foram vendidos para outra pessoa.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeUnavailableItems(unavailableProductIds)}
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Remover {unavailableProductIds.length} {unavailableProductIds.length === 1 ? 'item indisponível' : 'itens indisponíveis'}
          </Button>
        </div>
      )}

      {/* Cart Content - Grouped by Seller */}
      <div className="px-4 py-6 space-y-6">
        {groupedBySeller.map((group, groupIndex) => {
          const availableGroupItems = group.items.filter((item) => !isProductSold(item.productId));
          const groupHasUnavailableItems = group.items.some((item) => isProductSold(item.productId));
          const availableSubtotal = availableGroupItems.reduce(
            (acc, item) => acc + item.price * item.quantity,
            0
          );
          const canCheckoutGroup = availableGroupItems.length > 0;

          return (
            <div key={group.sellerId} className="card-premium p-4 space-y-4">
              {/* Seller Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {group.sellerAvatar ? (
                    <img 
                      src={group.sellerAvatar} 
                      alt={group.sellerName} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Vendedor</p>
                  <p className="font-medium text-foreground">{group.sellerName}</p>
                </div>
              </div>

              <Separator />

              {/* Seller Items */}
              <div className="space-y-3">
                {group.items.map((item) => {
                  const isSold = isProductSold(item.productId);

                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "flex gap-3 relative p-2 rounded-lg",
                        isSold && "opacity-60 bg-muted/30"
                      )}
                    >
                      {/* Sold Overlay */}
                      {isSold && (
                        <SoldOverlay onRemove={() => removeItem(item.id)} />
                      )}

                      {/* Product Image */}
                      <Link to={`/product/${item.productId}`} className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${item.productId}`}>
                          <h3 className="font-medium text-foreground text-sm line-clamp-1 hover:underline">
                            {item.title}
                          </h3>
                        </Link>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            {item.brand}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            Tam. {item.size}
                          </Badge>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-bold text-foreground text-sm">
                            R$ {item.price}
                          </span>
                          {item.originalPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              R$ {item.originalPrice}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remove Button */}
                      {!isSold && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          className="flex-shrink-0 w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Seller Subtotal & Checkout Button */}
              <div className="pt-2 border-t border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Subtotal ({availableGroupItems.length} {availableGroupItems.length === 1 ? 'item' : 'itens'})
                  </span>
                  <span className="font-bold text-lg text-foreground">
                    R$ {availableSubtotal.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {groupHasUnavailableItems && (
                  <p className="text-xs text-destructive">
                    Alguns itens deste vendedor não estão mais disponíveis
                  </p>
                )}

                <Button 
                  className="w-full btn-primary h-12"
                  onClick={() => navigate(`/checkout?seller=${group.sellerId}`)}
                  disabled={!canCheckoutGroup}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Seguir para Entrega
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Summary (informational only) */}
      <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-border/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total do carrinho</p>
            <p className="text-xl font-bold text-foreground">
              R$ {availableTotalAmount.toFixed(2).replace('.', ',')}
            </p>
            {hasSoldItems && (
              <p className="text-xs text-destructive">
                {itemCount - availableItemsCount} {itemCount - availableItemsCount === 1 ? 'item indisponível' : 'itens indisponíveis'}
              </p>
            )}
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="text-xs">
              {groupedBySeller.length} {groupedBySeller.length === 1 ? 'vendedor' : 'vendedores'}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">
              Finalize cada pedido acima
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
