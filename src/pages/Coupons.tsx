import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Tag, Percent, DollarSign, Ticket, Search, Trash2, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { fadeUpVariants, staggerContainer, staggerItem, DURATION, EASE } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  applies_to: 'all' | 'specific';
  listing_id: string | null;
  max_uses: number | null;
  expires_at: string | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  listing_title?: string;
  listing_image?: string;
}

interface UserListing {
  id: string;
  title: string;
  price: number;
  images: string[];
}

const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function Coupons() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [planChecked, setPlanChecked] = useState(false);

  // Guard: redirect non-loja users
  useEffect(() => {
    const checkPlan = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan_type, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasLoja = data?.plan_type === 'loja' && (!data.expires_at || new Date(data.expires_at) > new Date());
      if (!hasLoja) {
        navigate('/profile', { replace: true });
        return;
      }
      setPlanChecked(true);
    };
    checkPlan();
  }, [user, navigate]);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [percentageValue, setPercentageValue] = useState('');
  const [appliesTo, setAppliesTo] = useState<'all' | 'specific'>('all');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [codeError, setCodeError] = useState('');

  // Listings for selector
  const [listings, setListings] = useState<UserListing[]>([]);
  const [listingSearch, setListingSearch] = useState('');

  const fetchCoupons = useCallback(async () => {
    if (!user || !planChecked) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch listing titles for specific coupons
      const specificCoupons = data.filter(c => c.applies_to === 'specific' && c.listing_id);
      const listingIds = specificCoupons.map(c => c.listing_id).filter(Boolean) as string[];

      let listingMap: Record<string, { title: string; image: string }> = {};
      if (listingIds.length > 0) {
        const { data: listingsData } = await supabase
          .from('products')
          .select('id, title, images')
          .in('id', listingIds);

        if (listingsData) {
          listingsData.forEach(l => {
            listingMap[l.id] = { title: l.title, image: l.images?.[0] || '' };
          });
        }
      }

      setCoupons(data.map(c => ({
        ...c,
        discount_type: c.discount_type as 'percentage' | 'fixed',
        applies_to: c.applies_to as 'all' | 'specific',
        listing_title: c.listing_id ? listingMap[c.listing_id]?.title : undefined,
        listing_image: c.listing_id ? listingMap[c.listing_id]?.image : undefined,
      })));
    }

    setLoading(false);
  }, [user, planChecked]);

  const fetchListings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('products')
      .select('id, title, price, images')
      .eq('seller_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (data) {
      setListings(data);
    }
  }, [user]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons, planChecked]);

  if (!planChecked) return null;

  const resetForm = () => {
    setCode('');
    setDiscountType('percentage');
    setDiscountValue('');
    setPercentageValue('');
    setAppliesTo('all');
    setSelectedListingId(null);
    setLimitUses(false);
    setMaxUses('');
    setHasExpiration(false);
    setExpiresAt(undefined);
    setCodeError('');
    setEditingCoupon(null);
    setListingSearch('');
  };

  const openCreateSheet = () => {
    resetForm();
    fetchListings();
    setSheetOpen(true);
  };

  const openEditSheet = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDiscountType(coupon.discount_type);
    if (coupon.discount_type === 'fixed') {
      setDiscountValue(String(coupon.discount_value));
    } else {
      setPercentageValue(String(coupon.discount_value));
    }
    setAppliesTo(coupon.applies_to);
    setSelectedListingId(coupon.listing_id);
    setLimitUses(coupon.max_uses !== null);
    setMaxUses(coupon.max_uses !== null ? String(coupon.max_uses) : '');
    setHasExpiration(coupon.expires_at !== null);
    setExpiresAt(coupon.expires_at ? new Date(coupon.expires_at) : undefined);
    setCodeError('');
    fetchListings();
    setSheetOpen(true);
  };

  const handleToggleActive = async (couponId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', couponId)
      .eq('user_id', user!.id);

    if (!error) {
      setCoupons(prev => prev.map(c => c.id === couponId ? { ...c, is_active: isActive } : c));
    }
  };

  const handleDelete = async () => {
    if (!couponToDelete || !user) return;

    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', couponToDelete)
      .eq('user_id', user.id);

    if (!error) {
      setCoupons(prev => prev.filter(c => c.id !== couponToDelete));
      toast({ title: 'Cupom excluído' });
    } else {
      toast({ title: 'Erro ao excluir cupom', variant: 'destructive' });
    }

    setCouponToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleSave = async () => {
    if (!user) return;

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setCodeError('Informe o código do cupom');
      return;
    }

    const numericValue = discountType === 'percentage'
      ? parseFloat(percentageValue)
      : parseFloat(discountValue);

    if (isNaN(numericValue) || numericValue <= 0) {
      toast({ title: 'Informe um valor de desconto válido', variant: 'destructive' });
      return;
    }

    if (discountType === 'percentage' && numericValue > 100) {
      toast({ title: 'Percentual máximo é 100%', variant: 'destructive' });
      return;
    }

    if (appliesTo === 'specific' && !selectedListingId) {
      toast({ title: 'Selecione um anúncio', variant: 'destructive' });
      return;
    }

    setSaving(true);
    setCodeError('');

    const couponData = {
      user_id: user.id,
      code: trimmedCode,
      discount_type: discountType,
      discount_value: numericValue,
      applies_to: appliesTo,
      listing_id: appliesTo === 'specific' ? selectedListingId : null,
      max_uses: limitUses && maxUses ? parseInt(maxUses) : null,
      expires_at: hasExpiration && expiresAt ? expiresAt.toISOString() : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id)
          .eq('user_id', user.id);

        if (error) {
          if (error.code === '23505') {
            setCodeError('Esse código já existe');
            setSaving(false);
            return;
          }
          throw error;
        }

        toast({ title: 'Cupom atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(couponData);

        if (error) {
          if (error.code === '23505') {
            setCodeError('Esse código já existe');
            setSaving(false);
            return;
          }
          throw error;
        }

        toast({ title: 'Cupom criado com sucesso!' });
      }

      setSheetOpen(false);
      resetForm();
      fetchCoupons();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar cupom', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredListings = listings.filter(l =>
    l.title.toLowerCase().includes(listingSearch.toLowerCase())
  );

  const isFormValid = code.trim().length > 0 && (
    (discountType === 'percentage' && percentageValue && parseFloat(percentageValue) > 0 && parseFloat(percentageValue) <= 100) ||
    (discountType === 'fixed' && discountValue && parseFloat(discountValue) > 0)
  ) && (appliesTo === 'all' || selectedListingId);

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}% de desconto`;
    }
    return `R$ ${coupon.discount_value.toFixed(2).replace('.', ',')} de desconto`;
  };

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
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-display text-2xl font-semibold text-foreground">Cupons</h1>
            </div>
            <Button size="sm" onClick={openCreateSheet}>
              <Plus className="h-4 w-4 mr-1.5" />
              Criar cupom
            </Button>
          </motion.div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : coupons.length === 0 ? (
            /* Empty state */
            <motion.div variants={fadeUpVariants} className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center">
                <Ticket className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-foreground font-medium">Nenhum cupom criado ainda</p>
                <p className="text-sm text-muted-foreground">Crie cupons de desconto para atrair compradores</p>
              </div>
              <Button onClick={openCreateSheet} variant="outline" className="mt-2">
                <Plus className="h-4 w-4 mr-1.5" />
                Criar meu primeiro cupom
              </Button>
            </motion.div>
          ) : (
            /* Coupons list */
            <motion.div variants={staggerContainer} className="space-y-3 pb-6">
              {coupons.map(coupon => (
                <motion.div
                  key={coupon.id}
                  variants={staggerItem}
                  className={cn(
                    'card-elevated rounded-xl p-4 space-y-3 transition-opacity',
                    !coupon.is_active && 'opacity-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground text-base tracking-wider">
                          {coupon.code}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5">
                          {coupon.discount_type === 'percentage' ? '% Percentual' : 'R$ Valor fixo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDiscount(coupon)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {coupon.applies_to === 'all'
                            ? 'Todos os anúncios'
                            : coupon.listing_title || 'Anúncio específico'}
                        </span>
                        <span>•</span>
                        <span>Usado {coupon.use_count} {coupon.use_count === 1 ? 'vez' : 'vezes'}</span>
                        {coupon.max_uses && (
                          <>
                            <span>•</span>
                            <span>Limite: {coupon.max_uses}</span>
                          </>
                        )}
                        {coupon.expires_at && (
                          <>
                            <span>•</span>
                            <span>Expira: {format(new Date(coupon.expires_at), 'dd/MM/yyyy')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={(checked) => handleToggleActive(coupon.id, checked)}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => openEditSheet(coupon)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setCouponToDelete(coupon.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { if (!open) { setSheetOpen(false); resetForm(); } }}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>{editingCoupon ? 'Editar cupom' : 'Criar cupom'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 pb-8">
            {/* Field 1 — Código */}
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Código do cupom</Label>
              <Input
                id="coupon-code"
                placeholder="Ex: VERAO20"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setCodeError('');
                }}
                maxLength={20}
                className={cn('font-mono uppercase tracking-wider', codeError && 'border-destructive')}
              />
              {codeError && (
                <p className="text-xs text-destructive">{codeError}</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Seus compradores vão digitar esse código no checkout</p>
                <button
                  type="button"
                  className="text-xs text-primary font-medium hover:underline"
                  onClick={() => { setCode(generateCouponCode()); setCodeError(''); }}
                >
                  Gerar automaticamente
                </button>
              </div>
            </div>

            {/* Field 2 — Tipo de desconto */}
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors',
                    discountType === 'percentage'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted/30'
                  )}
                  onClick={() => setDiscountType('percentage')}
                >
                  <Percent className="h-3.5 w-3.5" />
                  Percentual
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors border-l border-border',
                    discountType === 'fixed'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted/30'
                  )}
                  onClick={() => setDiscountType('fixed')}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Valor fixo
                </button>
              </div>
            </div>

            {/* Field 3 — Valor */}
            <div className="space-y-2">
              <Label>{discountType === 'percentage' ? 'Percentual de desconto' : 'Valor do desconto'}</Label>
              {discountType === 'percentage' ? (
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="20"
                    value={percentageValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) {
                        setPercentageValue(v);
                      }
                    }}
                    min={1}
                    max={100}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">R$</span>
                  <CurrencyInput
                    value={discountValue}
                    onChange={setDiscountValue}
                    placeholder="0,00"
                  />
                </div>
              )}
              {/* Preview */}
              {((discountType === 'percentage' && percentageValue && parseFloat(percentageValue) > 0) ||
                (discountType === 'fixed' && discountValue && parseFloat(discountValue) > 0)) && (
                <p className="text-xs text-primary">
                  {discountType === 'percentage'
                    ? `O comprador pagará ${percentageValue}% menos`
                    : `O comprador economizará R$ ${parseFloat(discountValue).toFixed(2).replace('.', ',')}`}
                </p>
              )}
            </div>

            {/* Field 4 — Aplicar a */}
            <div className="space-y-3">
              <Label>Aplicar cupom a</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border py-2.5 px-3 text-sm font-medium transition-colors',
                    appliesTo === 'all'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                  )}
                  onClick={() => { setAppliesTo('all'); setSelectedListingId(null); }}
                >
                  Todos os anúncios
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border py-2.5 px-3 text-sm font-medium transition-colors',
                    appliesTo === 'specific'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/30'
                  )}
                  onClick={() => setAppliesTo('specific')}
                >
                  Anúncio específico
                </button>
              </div>

              {appliesTo === 'specific' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar anúncio..."
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
                    {filteredListings.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum anúncio ativo encontrado</p>
                    ) : (
                      filteredListings.map(listing => (
                        <button
                          key={listing.id}
                          type="button"
                          className={cn(
                            'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                            selectedListingId === listing.id
                              ? 'bg-primary/10 border border-primary/30'
                              : 'hover:bg-muted/30'
                          )}
                          onClick={() => setSelectedListingId(listing.id)}
                        >
                          {listing.images?.[0] && (
                            <img
                              src={listing.images[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{listing.title}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {listing.price.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Field 5 — Limite de uso */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Limitar número de usos</Label>
                <Switch checked={limitUses} onCheckedChange={setLimitUses} />
              </div>
              {limitUses && (
                <Input
                  type="number"
                  placeholder="Máximo de usos"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min={1}
                  inputMode="numeric"
                />
              )}
            </div>

            {/* Field 6 — Validade */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Definir data de expiração</Label>
                <Switch checked={hasExpiration} onCheckedChange={setHasExpiration} />
              </div>
              {hasExpiration && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expiresAt && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => { setSheetOpen(false); resetForm(); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!isFormValid || saving}
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  editingCoupon ? 'Salvar alterações' : 'Criar cupom'
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O cupom será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
