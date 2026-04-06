import { useState, useMemo, useEffect, useCallback } from 'react';
import defaultSellerAvatar from '@/assets/default-seller-avatar.png';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Share2, Instagram, Globe, Clock, Pencil, ExternalLink, Tag, Copy, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSellerProfile, useFollowSeller, useSellerProducts } from '@/hooks/useSellerProfile';
import { SellerStatsNav, SellerTab } from '@/components/seller/SellerStatsNav';
import { SellerFilters } from '@/components/seller/SellerFilters';
import { FollowersList } from '@/components/seller/FollowersList';
import { ReviewsList } from '@/components/seller/ReviewsList';
import { ProductCard } from '@/components/products/ProductCard';
import { ReputationBadge, VerificationBadge } from '@/components/reputation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

const DAYS_MAP: Record<string, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

export default function SellerProfile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { profile, stats, loading } = useSellerProfile(sellerId);
  const { isFollowing, loading: followLoading, toggleFollow } = useFollowSeller(sellerId);

  const [activeTab, setActiveTab] = useState<SellerTab>('products');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});

  const filters = useMemo(() => ({
    search: search || undefined,
    category: category || undefined,
    size: size || undefined,
    priceMin: priceRange.min,
    priceMax: priceRange.max,
  }), [search, category, size, priceRange]);

  const { products, loading: productsLoading, refetch: refetchProducts } = useSellerProducts(sellerId, filters);

  // Fetch seller's active coupons if enabled
  const [sellerCoupons, setSellerCoupons] = useState<any[]>([]);
  const showCouponsEnabled = useMemo(() => {
    if (!profile?.business_hours) return true;
    const flag = (profile.business_hours as any)?._show_coupons;
    return flag === undefined ? true : flag === true;
  }, [profile]);

  useEffect(() => {
    if (!sellerId || !showCouponsEnabled) {
      setSellerCoupons([]);
      return;
    }
    const fetchCoupons = async () => {
      const { data } = await supabase
        .from('coupons')
        .select('id, code, discount_type, discount_value, applies_to, expires_at')
        .eq('user_id', sellerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setSellerCoupons(data || []);
    };
    fetchCoupons();
  }, [sellerId, showCouponsEnabled]);

  const handleRefresh = useCallback(async () => {
    await refetchProducts();
  }, [refetchProducts]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const isOwnProfile = user?.id === sellerId;

  // Record profile view (fire-and-forget, dedup handled server-side)
  useEffect(() => {
    if (!sellerId || isOwnProfile) return;
    supabase.rpc('record_profile_view', { p_profile_user_id: sellerId }).then(({ error }) => {
      if (error) console.warn('[SellerProfile] Failed to record view:', error);
    });
  }, [sellerId, isOwnProfile]);

  const handleShare = async () => {
    const shareData = {
      title: `${profile?.display_name || 'Vendedor'} na Kura`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: 'Link copiado!',
          description: 'O link da loja foi copiado para a área de transferência.',
        });
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    await toggleFollow();
  };

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "'na Kura desde' MMMM yyyy", { locale: ptBR })
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-32 w-full" />
        <div className="px-4 -mt-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-48 mt-3" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Vendedor não encontrado</p>
      </div>
    );
  }

  const initials = profile.display_name?.slice(0, 2).toUpperCase() || 'US';

  return (
    <div className="min-h-screen bg-background pb-20">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* Banner */}
      <div className="relative h-32 md:h-48 bg-gradient-to-br from-primary/20 to-primary/5">
        {profile.banner_url && (
          <img
            src={profile.banner_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm hover:bg-background"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Action Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isOwnProfile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/settings/shop')}
                  className="bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Editar perfil público</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="bg-background/80 backdrop-blur-sm hover:bg-background"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="flex items-end justify-between">
          <div className="relative">
            {/* Main Avatar or Shop Logo */}
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage 
                src={profile.shop_logo_url || profile.avatar_url || undefined} 
                alt={profile.display_name || 'Vendedor'} 
              />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Small avatar badge if shop logo is present */}
            {profile.shop_logo_url && profile.avatar_url && (
              <Avatar className="h-8 w-8 border-2 border-background absolute -bottom-1 -right-1 shadow-md">
                <AvatarImage src={profile.avatar_url} alt={profile.display_name || 'Vendedor'} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {!isOwnProfile && (
            <Button
              variant={isFollowing ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleFollow}
              disabled={followLoading}
              className="mt-12"
            >
              {isFollowing ? 'Seguindo' : 'Seguir'}
            </Button>
          )}
        </div>

        <div className="mt-3">
          <h1 className="text-xl font-bold text-foreground inline-flex items-center gap-1.5">
            {profile.display_name || 'Vendedor'}
            <VerificationBadge level={profile.verification_level} size="md" />
          </h1>

          {profile.username && (
            <p className="text-sm text-primary font-medium">@{profile.username}</p>
          )}

          <div className="mt-1">
            <ReputationBadge
              reviewsCount={stats?.sellerReviewsCount || 0}
              reviewsSum={stats?.sellerReviewsSum || 0}
              type="seller"
              size="md"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            {profile.city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                <span>{profile.city}</span>
              </div>
            )}
            {memberSince && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{memberSince}</span>
              </div>
            )}
          </div>

          {/* Shop Description */}
          {profile.shop_description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {profile.shop_description}
            </p>
          )}

          {/* Social Links */}
          {(profile.social_instagram || profile.social_website) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.social_instagram && (
                <a
                  href={profile.social_instagram.startsWith('http') ? profile.social_instagram : `https://instagram.com/${profile.social_instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  <span>{profile.social_instagram}</span>
                </a>
              )}
              {profile.social_website && (
                <a
                  href={profile.social_website.startsWith('http') ? profile.social_website : `https://${profile.social_website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Website</span>
                </a>
              )}
            </div>
          )}

          {/* Shop Address */}
          {profile.business_hours && 
           (profile.business_hours as any)._has_physical_store && 
           (profile.business_hours as any)._shop_address && (
            (() => {
              const addr = (profile.business_hours as any)._shop_address;
              const parts = [
                addr.street,
                addr.number,
                addr.complement ? `- ${addr.complement}` : null,
                addr.neighborhood,
                `${addr.city}/${addr.state}`,
              ].filter(Boolean).join(', ');
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
              return (
                <details className="mt-3 bg-muted/30 rounded-lg group">
                  <summary className="flex items-center gap-2 p-3 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground flex-1">Endereço</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-3 pb-3">
                    <p className="text-xs text-muted-foreground">{parts}</p>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver no mapa
                    </a>
                  </div>
                </details>
              );
            })()
          )}

          {/* Business Hours */}
          {profile.business_hours && 
           Object.keys(profile.business_hours as object).length > 0 && 
           !(profile.business_hours as any)._hidden && (
            <details className="mt-3 bg-muted/30 rounded-lg group">
              <summary className="flex items-center gap-2 p-3 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground flex-1">Horário de Funcionamento</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {Object.entries(profile.business_hours as BusinessHours).map(([day, hours]) => {
                    if (!hours || typeof hours !== 'object') return null;
                    const isClosed = hours.closed === true;
                    const openTime = hours.open || '09:00';
                    const closeTime = hours.close || '18:00';
                    
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="font-medium">{DAYS_MAP[day] || day}</span>
                        <span>
                          {isClosed ? 'Fechado' : `${openTime} - ${closeTime}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
           )}

          {/* Coupons - Collapsible */}
          {showCouponsEnabled && sellerCoupons.length > 0 && (
            <details className="mt-3 bg-muted/30 rounded-lg group">
              <summary className="flex items-center gap-2 p-3 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground flex-1">
                  Cupons disponíveis ({sellerCoupons.length})
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {sellerCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="flex items-center justify-between gap-2 p-2 bg-background rounded-md border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {coupon.code}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}%`
                            : `R$ ${Number(coupon.discount_value).toFixed(2).replace('.', ',')}`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}% de desconto`
                          : `R$ ${Number(coupon.discount_value).toFixed(2).replace('.', ',')} de desconto`}
                        {coupon.applies_to === 'all' ? ' em todos os anúncios' : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(coupon.code);
                        toast({ title: 'Cupom copiado!', description: `Código ${coupon.code} copiado.` });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Stats Navigation */}
      <div className="mt-6">
        {stats && (
          <SellerStatsNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            stats={stats}
          />
        )}
      </div>

      {/* Filters (only show for products tab) */}
      {activeTab === 'products' && (
        <SellerFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          size={size}
          onSizeChange={setSize}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
        />
      )}

      {/* Content */}
      <div className="px-4">
        {activeTab === 'products' && (
          <>
            {productsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-xl" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      id: product.id,
                      title: product.title,
                      description: product.description,
                      price: product.price,
                      originalPrice: product.original_price,
                      size: product.size,
                      brand: product.brand,
                      category: product.category,
                      condition: product.condition,
                      images: product.images,
                      sellerId: product.seller_id,
                      sellerName: profile.display_name || 'Vendedor',
                      sellerAvatar: profile.shop_logo_url || profile.avatar_url || defaultSellerAvatar,
                      sellerReviewsCount: stats?.sellerReviewsCount || 0,
                      sellerReviewsSum: stats?.sellerReviewsSum || 0,
                      distance: 0,
                      city: product.seller_city || '',
                      createdAt: new Date(product.created_at),
                      gender: product.gender as 'M' | 'F' | 'U',
                      status: product.status,
                    }}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {search || category || size || priceRange.min || priceRange.max
                    ? 'Nenhum produto encontrado com esses filtros'
                    : 'Nenhum produto à venda'}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'sold' && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {stats?.soldProducts || 0} produtos vendidos
            </p>
          </div>
        )}

        {activeTab === 'reviews' && sellerId && (
          <ReviewsList sellerId={sellerId} />
        )}

        {activeTab === 'followers' && sellerId && (
          <FollowersList sellerId={sellerId} />
        )}
      </div>
    </div>
  );
}
