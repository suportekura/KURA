import { motion } from 'framer-motion';
import { useState } from 'react';
import { MapPin, LogIn, ChevronDown, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCart } from '@/contexts/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { LocationUpdateSheet } from '@/components/location';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationCenter } from '@/components/notifications';
import kuraIcon from '@/assets/kura-icon.png';

export function Header() {
  const { user } = useAuth();
  const { location, loading, hasLocation } = useGeolocation();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [showLocationSheet, setShowLocationSheet] = useState(false);

  const handleCartClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      navigate('/auth', { state: { returnTo: '/cart' } });
    }
  };

  const locationDisplay = hasLocation && location
    ? (location.city || 'Sua região')
    : 'Definir';

  return (
    <>
      <header 
        className="sticky top-0 z-40 glass-effect border-b border-border/30"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao início">
              <img src={kuraIcon} alt="Kura" className="w-9 h-9 rounded-xl object-cover" loading="eager" decoding="sync" fetchPriority="high" />
            </button>
            <motion.button 
              onClick={() => setShowLocationSheet(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              whileTap={{ scale: 0.97 }}
            >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Sua localização
              </p>
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : (
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    {locationDisplay}
                  </p>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </motion.button>
          </div>

          <div className="flex items-center gap-1">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/cart" onClick={handleCartClick}>
                  <ShoppingCart className="w-5 h-5" />
                  {itemCount > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center"
                    >
                      {itemCount > 99 ? '99+' : itemCount}
                    </motion.span>
                  )}
                </Link>
              </Button>
            </motion.div>

            {user ? (
              <NotificationCenter />
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <LocationUpdateSheet 
        open={showLocationSheet} 
        onOpenChange={setShowLocationSheet} 
      />
    </>
  );
}
