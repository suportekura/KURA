import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Flame, Rocket, Loader2, Zap, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DURATION, EASE } from '@/lib/animations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BoostCredits {
  '24h': number;
  '3d': number;
  '7d': number;
}

interface BoostSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; title: string } | null;
  credits: BoostCredits | null;
  onBoostActivated?: () => void;
}

const boostOptions = [
  { type: '24h' as const, label: '24 horas', icon: Clock, description: 'Destaque rápido por 1 dia' },
  { type: '3d' as const, label: '3 dias', icon: Flame, description: 'Visibilidade contínua por 3 dias' },
  { type: '7d' as const, label: '7 dias', icon: Rocket, description: 'Máxima exposição por 1 semana' },
];

export function BoostSelectionModal({ open, onOpenChange, product, credits, onBoostActivated }: BoostSelectionModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activating, setActivating] = useState<string | null>(null);

  const handleActivate = async (boostType: '24h' | '3d' | '7d') => {
    if (!user || !product) return;

    const available = credits?.[boostType] ?? 0;

    if (available <= 0) {
      // No credits — redirect to /boosts with product pre-selected
      onOpenChange(false);
      navigate(`/boosts?product=${product.id}`);
      return;
    }

    setActivating(boostType);

    try {
      const { data, error } = await supabase.rpc('activate_product_boost', {
        p_product_id: product.id,
        p_boost_type: boostType,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string; expires_at?: string };

      if (!result.success) {
        toast({ title: 'Não foi possível impulsionar', description: result.error, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Anúncio impulsionado! 🚀',
        description: `"${product.title}" está no topo até ${new Date(result.expires_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
      });

      onOpenChange(false);
      onBoostActivated?.();
    } catch (err: any) {
      toast({ title: 'Erro ao impulsionar', description: err.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setActivating(null);
    }
  };

  const hasAnyCredits = credits && (credits['24h'] > 0 || credits['3d'] > 0 || credits['7d'] > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!left-auto !right-auto !translate-x-0 inset-x-4 sm:!left-[50%] sm:!translate-x-[-50%] sm:inset-x-auto sm:max-w-md rounded-2xl border-border/30 shadow-[0_16px_48px_-12px_hsl(var(--foreground)/0.12)] p-0 gap-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.normal, ease: EASE.out }}
        >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              Impulsionar anúncio
            </DialogTitle>
            {product && (
              <DialogDescription className="text-xs mt-1.5 line-clamp-1">
                {product.title}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Options */}
        <div className="px-6 pb-2 space-y-2">
          {boostOptions.map((option) => {
            const available = credits?.[option.type] ?? 0;
            const isLoading = activating === option.type;
            const Icon = option.icon;

            return (
              <button
                key={option.type}
                disabled={!!activating}
                onClick={() => handleActivate(option.type)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-border/40 bg-card hover:border-primary/25 hover:shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.1)] transition-all duration-200 text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{option.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{option.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : available > 0 ? (
                    <Badge variant="secondary" className="text-[11px] font-medium rounded-lg px-2.5 py-0.5">
                      {available}×
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground rounded-lg px-2.5 py-0.5 border-border/60">
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      Comprar
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {!hasAnyCredits && (
          <div className="px-6 pb-5 pt-2">
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Sem créditos disponíveis. Selecione um tipo para adquirir na loja.
            </p>
          </div>
        )}
        {hasAnyCredits && <div className="pb-5" />}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
