import { ChevronRight, Package, ShoppingBag, Heart, Star, Moon, Sun, LogOut, Camera, Trash2, Settings, Store, Eye, Users, Pencil, Crown, Zap, BarChart3, Tag, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { fadeUpVariants, staggerContainer, staggerItem, scaleInVariants, DURATION, EASE } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useFavoritesCount } from '@/hooks/useFavorites';
import { useUserListingsCount, useUserProfile } from '@/hooks/useUserProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calculateWeightedRating } from '@/components/reputation/ReputationBadge';
import { PublicProfileInfoDialog, shouldShowPublicProfileInfo } from '@/components/profile/PublicProfileInfoDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ReputationData {
  seller_reviews_count: number;
  seller_reviews_sum: number;
  buyer_reviews_count: number;
  buyer_reviews_sum: number;
  sold_count: number;
}

// Section label component
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-2">
      {children}
    </p>
  );
}

// Menu row component
interface MenuRowProps {
  icon: React.ElementType;
  label: string;
  iconBg: string;
  iconColor: string;
  badge?: number;
  badgeColor?: string;
  onClick?: () => void;
  href?: string;
  isLast?: boolean;
  trailing?: React.ReactNode;
}

function MenuRow({ icon: Icon, label, iconBg, iconColor, badge, badgeColor, onClick, href, isLast, trailing }: MenuRowProps) {
  const content = (
    <>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <span className="flex-1 text-left font-medium text-foreground text-sm">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor || 'bg-muted text-muted-foreground'}`}>
          {badge}
        </span>
      )}
      {trailing || <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
    </>
  );

  const className = `w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left ${!isLast ? 'border-b border-border/40' : ''}`;

  if (href) {
    return <Link to={href} className={className}>{content}</Link>;
  }

  return <button onClick={onClick} className={className}>{content}</button>;
}

export default function Profile() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { profile, refetch: refetchProfile } = useUserProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const favoritesCount = useFavoritesCount();
  const listingsCount = useUserListingsCount();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPublicProfileInfo, setShowPublicProfileInfo] = useState(false);
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [boostData, setBoostData] = useState<{ credits: { '24h': number; '3d': number; '7d': number }; renewal: string | null } | null>(null);
  const [planType, setPlanType] = useState<string>('free');
  const [showCouponUpsell, setShowCouponUpsell] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch avatar URL and reputation from profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, seller_reviews_count, seller_reviews_sum, buyer_reviews_count, buyer_reviews_sum')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const { count: soldCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .eq('status', 'sold');
      
      if (data) {
        if (data.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
        setReputation({
          seller_reviews_count: data.seller_reviews_count || 0,
          seller_reviews_sum: Number(data.seller_reviews_sum) || 0,
          buyer_reviews_count: data.buyer_reviews_count || 0,
          buyer_reviews_sum: Number(data.buyer_reviews_sum) || 0,
          sold_count: soldCount || 0,
        });
      }
    };
    
    fetchProfile();
  }, [user]);

  // Fetch purchases count
  useEffect(() => {
    const fetchPurchasesCount = async () => {
      if (!user) return;
      
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .in('status', ['confirmed', 'in_transit', 'delivered']);
      
      setPurchasesCount(count || 0);
    };
    
    fetchPurchasesCount();
  }, [user]);

  // Fetch boost data
  useEffect(() => {
    const fetchBoosts = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_boosts')
        .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d, renewal_date')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setBoostData({
          credits: {
            '24h': data.total_boosts_24h - data.used_boosts_24h,
            '3d': data.total_boosts_3d - data.used_boosts_3d,
            '7d': data.total_boosts_7d - data.used_boosts_7d,
          },
          renewal: data.renewal_date,
        });
      }
    };
    
    fetchBoosts();
  }, [user]);

  // Fetch subscription plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan_type, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const isActive = !data.expires_at || new Date(data.expires_at) > new Date();
        setPlanType(isActive ? data.plan_type : 'free');
      }
    };
    
    fetchPlan();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Até logo!',
      description: 'Você saiu da sua conta.',
    });
    navigate('/auth');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Use JPEG, PNG, WEBP ou GIF.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBust);
      refetchProfile();

      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi alterada.',
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro ao enviar foto',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setUploading(true);

    try {
      const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id);

      if (files && files.length > 0) {
        const filesToDelete = files.map(f => `${user.id}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToDelete);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      refetchProfile();

      toast({
        title: 'Foto removida',
        description: 'Sua foto de perfil foi removida.',
      });
    } catch (error: any) {
      console.error('Error removing avatar:', error);
      toast({
        title: 'Erro ao remover foto',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const userName = profile?.pfProfile?.display_name || profile?.pjProfile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const userEmail = user?.email || '';
  const userUsername = profile?.username || null;

  return (
    <AppLayout showHeader={false}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-5"
      >
        <div className="px-4 pt-6 space-y-5">
          {/* Header */}
          <motion.div variants={fadeUpVariants} transition={{ duration: DURATION.fast, ease: EASE.out }} className="flex items-center justify-between -mt-2">
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Perfil
            </h1>
          </motion.div>

          {/* Profile Card */}
          <motion.div variants={scaleInVariants} transition={{ duration: DURATION.normal, ease: EASE.out }} className="card-elevated p-5 space-y-4">
            <div className="flex items-center gap-4">
              {/* Avatar with edit dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="relative group focus:outline-none"
                    disabled={uploading}
                  >
                    <Avatar className="w-14 h-14 ring-4 ring-primary/20">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={userName} />
                      ) : null}
                      <AvatarFallback className="bg-primary/20 text-2xl font-bold text-primary">
                        {userName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" />
                    {avatarUrl ? 'Alterar foto' : 'Adicionar foto'}
                  </DropdownMenuItem>
                  {avatarUrl && (
                    <DropdownMenuItem 
                      onClick={handleRemoveAvatar}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover foto
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-foreground truncate">
                    {userName}
                  </h2>
                  {planType !== 'free' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                      planType === 'loja'
                        ? 'bg-[hsl(43_60%_90%)] text-[hsl(43_80%_35%)]'
                        : 'bg-[hsl(210_60%_92%)] text-[hsl(210_70%_40%)]'
                    }`}>
                      <Crown className="w-3 h-3" />
                      {planType === 'plus' ? 'Plus' : planType === 'loja' ? 'Loja Oficial' : planType}
                    </span>
                  )}
                </div>
                {userUsername && (
                  <button
                    onClick={() => navigate('/settings/profile')}
                    className="text-sm text-primary font-medium hover:underline text-left"
                  >
                    @{userUsername}
                  </button>
                )}
                <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  <span className="text-sm font-medium">
                    {reputation && reputation.seller_reviews_count > 3 
                      ? calculateWeightedRating(reputation.seller_reviews_sum, reputation.seller_reviews_count).toFixed(2)
                      : '5.0'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • {reputation && reputation.seller_reviews_count > 0 
                        ? `${reputation.seller_reviews_count} ${reputation.seller_reviews_count === 1 ? 'avaliação' : 'avaliações'}` 
                        : 'Sem avaliações'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats as 3 equal cards */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/40">
              <button onClick={() => navigate('/my-sales')} className="bg-muted/40 rounded-xl py-3 px-2 text-center hover:bg-muted/60 transition-colors">
                <p className="text-lg font-bold text-foreground">{reputation?.sold_count || 0}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vendas</p>
              </button>
              <button onClick={() => navigate('/my-purchases')} className="bg-muted/40 rounded-xl py-3 px-2 text-center hover:bg-muted/60 transition-colors">
                <p className="text-lg font-bold text-foreground">{purchasesCount}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Compras</p>
              </button>
              <button onClick={() => navigate('/my-listings')} className="bg-muted/40 rounded-xl py-3 px-2 text-center hover:bg-muted/60 transition-colors">
                <p className="text-lg font-bold text-foreground">{listingsCount}</p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Anúncios</p>
              </button>
            </div>
          </motion.div>

          {/* Group 1 — Plano & benefícios */}
          <motion.div variants={staggerItem}>
            <SectionLabel>Plano & benefícios</SectionLabel>
            <div className="card-premium overflow-hidden">
              <MenuRow
                icon={Crown}
                label="Planos"
                iconBg="bg-[hsl(43_60%_90%)]"
                iconColor="text-[hsl(43_80%_40%)]"
                href="/plans"
              />
              <MenuRow
                icon={Zap}
                label="Boosts"
                iconBg="bg-[hsl(43_60%_90%)]"
                iconColor="text-[hsl(43_80%_40%)]"
                href="/boosts"
              />
              {planType === 'loja' ? (
                <MenuRow
                  icon={Tag}
                  label="Cupons"
                  iconBg="bg-[hsl(43_60%_90%)]"
                  iconColor="text-[hsl(43_80%_40%)]"
                  href="/profile/coupons"
                  isLast
                />
              ) : (
                <button
                  onClick={() => setShowCouponUpsell(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left opacity-60"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[hsl(43_60%_90%)]">
                    <Tag className="w-4 h-4 text-[hsl(43_80%_40%)]" />
                  </div>
                  <span className="flex-1 text-left font-medium text-foreground text-sm">
                    Cupons
                  </span>
                  <Lock className="w-4 h-4 text-muted-foreground/50" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Group 2 — Minha loja */}
          <motion.div variants={staggerItem}>
            <SectionLabel>Minha loja</SectionLabel>
            <div className="card-premium overflow-hidden">
              <MenuRow
                icon={Store}
                label="Perfil público"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                onClick={() => {
                  if (shouldShowPublicProfileInfo()) {
                    setShowPublicProfileInfo(true);
                  } else if (user) {
                    navigate(`/seller/${user.id}`);
                  }
                }}
              />
              <MenuRow
                icon={BarChart3}
                label="Dashboard"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/dashboard"
              />
              <MenuRow
                icon={Package}
                label="Meus anúncios"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                badge={listingsCount}
                badgeColor="bg-muted text-background dark:text-muted-foreground"
                href="/my-listings"
                isLast
              />
            </div>
          </motion.div>

          {/* Group 3 — Atividades */}
          <motion.div variants={staggerItem}>
            <SectionLabel>Atividades</SectionLabel>
            <div className="card-premium overflow-hidden">
              <MenuRow
                icon={Store}
                label="Minhas vendas"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/my-sales"
              />
              <MenuRow
                icon={ShoppingBag}
                label="Minhas compras"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/my-purchases"
              />
              <MenuRow
                icon={Heart}
                label="Favoritos"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                badge={favoritesCount}
                badgeColor="bg-muted text-background dark:text-muted-foreground"
                href="/favorites"
              />
              <MenuRow
                icon={Users}
                label="Seguindo"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/following"
                isLast
              />
            </div>
          </motion.div>

          {/* Group 4 — Preferências */}
          <motion.div variants={staggerItem}>
            <SectionLabel>Preferências</SectionLabel>
            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted">
                  {theme === 'dark' ? (
                    <Moon className="w-4 h-4 text-background dark:text-muted-foreground" />
                  ) : (
                    <Sun className="w-4 h-4 text-background dark:text-muted-foreground" />
                  )}
                </div>
                <span className="flex-1 font-medium text-foreground text-sm">Tema escuro</span>
                <Switch 
                  checked={theme === 'dark'} 
                  onCheckedChange={toggleTheme}
                />
              </div>
              <MenuRow
                icon={Star}
                label="Avaliações"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/reviews"
              />
              <MenuRow
                icon={Settings}
                label="Configurações"
                iconBg="bg-muted"
                iconColor="text-background dark:text-muted-foreground"
                href="/settings"
                isLast
              />
            </div>
          </motion.div>

          {/* Logout — isolated */}
          <motion.div variants={staggerItem} className="pb-4">
            <button 
              className="w-full flex items-center justify-center gap-2 py-3 text-destructive text-sm font-medium hover:opacity-80 transition-opacity"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Public Profile Info Dialog */}
      <PublicProfileInfoDialog
        open={showPublicProfileInfo}
        onOpenChange={setShowPublicProfileInfo}
        onContinue={() => {
          if (user) {
            navigate(`/seller/${user.id}`);
          }
        }}
      />

      {/* Coupon Upsell Modal */}
      <Dialog open={showCouponUpsell} onOpenChange={setShowCouponUpsell}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader className="items-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Crown className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle>Funcionalidade exclusiva</DialogTitle>
            <DialogDescription>
              O gerenciamento de cupons está disponível apenas para o plano Loja Oficial. Faça upgrade para desbloquear.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={() => { setShowCouponUpsell(false); navigate('/plans'); }}>
              Ver planos
            </Button>
            <Button variant="ghost" onClick={() => setShowCouponUpsell(false)}>
              Agora não
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}