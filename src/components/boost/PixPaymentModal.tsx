import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Loader2, QrCode, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  qrcode?: string;
  qrcodeUrl?: string;
  payload: string;
  expiration: string;
  amount: number;
  label: string; // e.g. "Boost 24 horas" or "Plano Vendedor Plus Mensal"
  paymentTable?: 'boost_payments' | 'plan_payments';
  onConfirmed: () => void;
  // Legacy props
  boostType?: string;
}

export function PixPaymentModal({
  open,
  onOpenChange,
  paymentId,
  qrcode,
  qrcodeUrl,
  payload,
  expiration,
  amount,
  label,
  paymentTable = 'boost_payments',
  onConfirmed,
}: PixPaymentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const qrImageSrc = qrcodeUrl || (qrcode?.startsWith('http') ? qrcode : qrcode ? `data:image/png;base64,${qrcode}` : '');

  useEffect(() => {
    if (!open || !expiration) return;
    const update = () => {
      const diff = new Date(expiration).getTime() - Date.now();
      if (diff <= 0) { setIsExpired(true); setTimeLeft('Expirado'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open, expiration]);

  useEffect(() => {
    if (!open || !paymentId || isExpired || !user) return;
    const poll = async () => {
      const { data } = await supabase
        .from(paymentTable)
        .select('status')
        .eq('id', paymentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.status === 'confirmed') {
        toast({ title: 'Pagamento confirmado! 🎉', description: `${label} ativado com sucesso.` });
        onConfirmed();
        onOpenChange(false);
      }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [open, paymentId, isExpired, label, paymentTable, onConfirmed, onOpenChange, toast, user?.id]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast({ title: 'Código PIX copiado!' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  }, [payload, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-auto !right-auto !translate-x-0 inset-x-4 sm:!left-[50%] sm:!translate-x-[-50%] sm:inset-x-auto sm:max-w-md rounded-2xl border-border/30 shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-primary" />
              </div>
              Pagamento PIX
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              {label} — R$ {amount.toFixed(2).replace('.', ',')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 flex flex-col items-center gap-4">
          <div className="w-56 h-56 bg-white rounded-2xl p-3 shadow-sm border border-border/20">
            {qrImageSrc ? (
              <img src={qrImageSrc} alt="QR Code PIX" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {isExpired ? (
              <span className="text-destructive font-medium">QR Code expirado</span>
            ) : (
              <span>Expira em <span className="font-mono font-medium text-foreground">{timeLeft}</span></span>
            )}
          </div>
        </div>

        <div className="px-6 py-4">
          <Button variant="outline" className="w-full rounded-xl" onClick={handleCopy} disabled={isExpired}>
            {copied ? (
              <><Check className="w-4 h-4 mr-2 text-primary" /> Copiado!</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" /> Copiar código PIX</>
            )}
          </Button>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/50">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Aguardando pagamento...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
