import { useState, useCallback, useEffect } from 'react';
import { CreditCard, Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CreditCardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  label: string; // e.g. "Boost 24 horas" or "Plano Vendedor Plus Mensal"
  edgeFunctionName: string; // e.g. "create-boost-payment-card" or "create-plan-payment-card"
  edgeFunctionBody: Record<string, any>; // extra body params
  onConfirmed: () => void;
  // Legacy props
  boostType?: string;
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

export function CreditCardPaymentModal({
  open,
  onOpenChange,
  amount,
  label,
  edgeFunctionName,
  edgeFunctionBody,
  onConfirmed,
}: CreditCardPaymentModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  useEffect(() => {
    if (open) { setError(''); setSuccess(false); }
  }, [open]);

  const isValid =
    cardNumber.replace(/\s/g, '').length >= 13 &&
    holderName.trim().length >= 3 &&
    expiry.length === 5 &&
    cvv.length >= 3;

  const handleSubmit = useCallback(async () => {
    if (!isValid || isProcessing) return;
    setIsProcessing(true);
    setError('');

    try {
      const [expMonth, expYearShort] = expiry.split('/');
      const expYear = parseInt(expYearShort) < 100 ? 2000 + parseInt(expYearShort) : parseInt(expYearShort);

      const { data, error: fnError } = await supabase.functions.invoke(edgeFunctionName, {
        body: {
          ...edgeFunctionBody,
          card_number: cardNumber.replace(/\s/g, ''),
          card_holder_name: holderName.trim().toUpperCase(),
          card_exp_month: parseInt(expMonth),
          card_exp_year: expYear,
          card_cvv: cvv,
        },
      });

      if (fnError || !data?.success) {
        setError(data?.error || fnError?.message || 'Erro ao processar pagamento');
        return;
      }

      toast({ title: 'Pagamento confirmado! 🎉', description: `${label} ativado com sucesso.` });
      onConfirmed();
      setSuccess(true);
      setCardNumber(''); setHolderName(''); setExpiry(''); setCvv('');
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setIsProcessing(false);
    }
  }, [isValid, isProcessing, cardNumber, holderName, expiry, cvv, edgeFunctionName, edgeFunctionBody, label, onConfirmed, toast]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="!left-auto !right-auto !translate-x-0 inset-x-4 sm:!left-[50%] sm:!translate-x-[-50%] sm:inset-x-auto sm:max-w-md rounded-2xl border-border/30 shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] p-0 gap-0 overflow-hidden">
        {success ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">Pagamento realizado!</h2>
            <Button className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
        <>
        <div className="px-6 pt-6 pb-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              Cartão de Crédito
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              {label} — R$ {amount.toFixed(2).replace('.', ',')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-number" className="text-xs">Número do cartão</Label>
            <Input id="card-number" placeholder="0000 0000 0000 0000" value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} maxLength={19}
              inputMode="numeric" className="rounded-xl" disabled={isProcessing} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="holder-name" className="text-xs">Nome no cartão</Label>
            <Input id="holder-name" placeholder="NOME COMO ESTÁ NO CARTÃO" value={holderName}
              onChange={(e) => setHolderName(e.target.value.toUpperCase())} className="rounded-xl uppercase"
              disabled={isProcessing} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expiry" className="text-xs">Validade</Label>
              <Input id="expiry" placeholder="MM/AA" value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))} maxLength={5}
                inputMode="numeric" className="rounded-xl" disabled={isProcessing} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cvv" className="text-xs">CVV</Label>
              <Input id="cvv" placeholder="000" value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4}
                inputMode="numeric" className="rounded-xl" disabled={isProcessing} />
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 pt-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          <Button className="w-full rounded-xl" disabled={!isValid || isProcessing} onClick={handleSubmit}>
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
            ) : (
              <>Pagar R$ {amount.toFixed(2).replace('.', ',')}</>
            )}
          </Button>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>Pagamento seguro processado pelo Pagar.me</span>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
