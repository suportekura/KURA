import { useState, useCallback } from 'react';
import { Tag, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

export interface CouponData {
  couponId: string;
  discountAmount: number;
  finalAmount: number;
}

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  appliesTo: string;
  originalAmount: number;
  loading?: boolean;
  onPayPix: (finalAmount: number, coupon?: CouponData) => void;
  onPayCard: (finalAmount: number, coupon?: CouponData) => void;
}

export function CheckoutModal({
  open,
  onOpenChange,
  title,
  description,
  appliesTo,
  originalAmount,
  loading = false,
  onPayPix,
  onPayCard,
}: CheckoutModalProps) {
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [couponError, setCouponError] = useState('');
  const [validating, setValidating] = useState(false);

  const finalAmount = couponData ? couponData.finalAmount : originalAmount;

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setValidating(true);
    setCouponError('');
    setCouponData(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: couponCode.trim(), applies_to: appliesTo, amount: originalAmount },
      });
      if (error || !data?.valid) {
        setCouponError(data?.error || 'Cupom inválido');
      } else {
        setCouponData({
          couponId: data.coupon_id,
          discountAmount: data.discount_amount,
          finalAmount: data.final_amount,
        });
      }
    } catch {
      setCouponError('Erro ao validar cupom');
    } finally {
      setValidating(false);
    }
  }, [couponCode, appliesTo, originalAmount]);

  const handleRemoveCoupon = () => {
    setCouponData(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setCouponCode('');
      setCouponData(null);
      setCouponError('');
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl border-border/30 p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-xs mt-1">{description}</DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Price */}
        <div className="px-6 pb-4">
          <div className="flex items-baseline gap-2">
            {couponData && (
              <span className="text-sm text-muted-foreground line-through">
                R$ {originalAmount.toFixed(2).replace('.', ',')}
              </span>
            )}
            <span className="text-2xl font-bold text-foreground">
              R$ {finalAmount.toFixed(2).replace('.', ',')}
            </span>
            {couponData && (
              <span className="text-xs text-green-600 font-medium">
                -{((couponData.discountAmount / originalAmount) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Coupon input */}
        <div className="px-6 pb-4">
          {couponData ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-xs text-green-700 dark:text-green-400 flex-1">
                Cupom <strong>{couponCode.toUpperCase()}</strong> aplicado — economia de R$ {couponData.discountAmount.toFixed(2).replace('.', ',')}
              </span>
              <button onClick={handleRemoveCoupon} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 rounded-xl text-sm uppercase"
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value); setCouponError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  disabled={validating}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl shrink-0"
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || validating}
              >
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar'}
              </Button>
            </div>
          )}
          {couponError && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{couponError}</p>
            </div>
          )}
        </div>

        {/* Payment buttons */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            className="w-full rounded-xl"
            onClick={() => onPayPix(finalAmount, couponData ?? undefined)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Pagar com PIX
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => onPayCard(finalAmount, couponData ?? undefined)}
            disabled={loading}
          >
            Pagar com Cartão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
