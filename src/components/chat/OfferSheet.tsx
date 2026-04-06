import { useState } from 'react';
import { Tag, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DURATION, EASE } from '@/lib/animations';

interface OfferSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTitle: string;
  productPrice: number;
  productImage?: string | null;
  isCounterOffer?: boolean;
  previousAmount?: number;
  onSubmit: (amount: number) => Promise<void>;
}

export function OfferSheet({
  open,
  onOpenChange,
  productTitle,
  productPrice,
  productImage,
  isCounterOffer = false,
  previousAmount,
  onSubmit,
}: OfferSheetProps) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const discount = parsedAmount > 0 ? ((productPrice - parsedAmount) / productPrice) * 100 : 0;
  const isValid = parsedAmount > 0 && parsedAmount <= productPrice;

  const quickOffers = [
    { label: '-5%', value: productPrice * 0.95 },
    { label: '-10%', value: productPrice * 0.9 },
    { label: '-15%', value: productPrice * 0.85 },
    { label: '-20%', value: productPrice * 0.8 },
  ];

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(parsedAmount);
      setAmount('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            {isCounterOffer ? 'Fazer contra-oferta' : 'Fazer uma oferta'}
          </SheetTitle>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: DURATION.normal, ease: EASE.out }}
          className="mt-4 space-y-4"
        >
          {/* Product info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            {productImage && (
              <img
                src={productImage}
                alt=""
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{productTitle}</p>
              <p className="text-sm text-muted-foreground">
                Preço: R$ {productPrice.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Previous offer info */}
          {isCounterOffer && previousAmount && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">
                Oferta anterior: R$ {previousAmount.toFixed(2)}
              </p>
            </div>
          )}

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="offer-amount">Seu valor</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="offer-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="pl-10 text-lg font-semibold"
              />
            </div>
            {parsedAmount > 0 && (
              <p className={cn(
                'text-xs',
                discount > 0 ? 'text-emerald-500' : 'text-muted-foreground'
              )}>
                {discount > 0
                  ? `${discount.toFixed(0)}% de desconto`
                  : parsedAmount > productPrice
                  ? 'Valor acima do preço'
                  : 'Mesmo valor do produto'}
              </p>
            )}
          </div>

          {/* Quick offer buttons */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sugestões rápidas</Label>
            <div className="flex gap-2">
              {quickOffers.map((offer) => (
                <Button
                  key={offer.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(offer.value.toFixed(2).replace('.', ','))}
                  className="flex-1"
                >
                  {offer.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full btn-primary"
          >
            {submitting
              ? 'Enviando...'
              : isCounterOffer
              ? 'Enviar contra-oferta'
              : 'Enviar oferta'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            A oferta expira em 24 horas se não for respondida
          </p>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
