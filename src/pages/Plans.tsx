import { ArrowLeft, Check, Crown, Sparkles, Store, Zap, Image, BarChart3, Tag, Headphones, Upload, ShieldCheck, HelpCircle, Loader2, ArrowDown, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PixPaymentModal } from '@/components/boost/PixPaymentModal';
import { CreditCardPaymentModal } from '@/components/boost/CreditCardPaymentModal';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type BillingCycle = 'monthly' | 'annual';

interface PlanPricing {
  monthly: number;
  annual: number;
  annualMonthly: string;
  discount: string;
}

const pricing: Record<string, PlanPricing> = {
  free: { monthly: 0, annual: 0, annualMonthly: '', discount: '' },
  plus: { monthly: 39.90, annual: 383.04, annualMonthly: 'R$31,92', discount: '-20%' },
  loja: { monthly: 99.90, annual: 959.04, annualMonthly: 'R$79,92', discount: '-20%' },
};

const plans = [
  {
    id: 'free',
    name: 'Free',
    highlighted: false,
    popularLabel: null,
    features: [
      { icon: Sparkles, text: 'Até 10 anúncios ativos' },
      { icon: Image, text: '5 fotos por produto' },
      { icon: Zap, text: 'Sem destaque automático' },
    ],
  },
  {
    id: 'plus',
    name: 'Vendedor Plus',
    highlighted: true,
    popularLabel: 'Mais Popular',
    features: [
      { icon: Sparkles, text: 'Até 50 anúncios ativos' },
      { icon: Image, text: '10 fotos por produto' },
      { icon: Crown, text: '1 destaque grátis por mês' },
      { icon: ShieldCheck, text: 'Selo "Vendedor Verificado"' },
    ],
  },
  {
    id: 'loja',
    name: 'Loja Oficial',
    highlighted: false,
    popularLabel: null,
    features: [
      { icon: Sparkles, text: 'Anúncios ilimitados' },
      { icon: Upload, text: 'Upload em lote' },
      { icon: BarChart3, text: 'Dashboard completo' },
      { icon: Tag, text: 'Cupom de desconto' },
      { icon: Store, text: 'Badge "Loja Oficial" (Ouro)' },
      { icon: Headphones, text: 'Suporte prioritário' },
    ],
  },
];

export default function Plans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [currentBillingCycle, setCurrentBillingCycle] = useState<string | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [downgradingPlan, setDowngradingPlan] = useState<string | null>(null);
  const [downgradeConfirm, setDowngradeConfirm] = useState<{
    targetPlan: string;
    expiresAt: string | null;
  } | null>(null);

  const [pixModal, setPixModal] = useState<{
    open: boolean;
    paymentId: string;
    qrcodeUrl: string;
    payload: string;
    expiration: string;
    amount: number;
    planType: string;
    billingCycle: string;
  } | null>(null);

  const [cardModal, setCardModal] = useState<{
    open: boolean;
    planType: string;
    billingCycle: string;
    amount: number;
  } | null>(null);

  // Fetch current subscription
  useEffect(() => {
    if (!user) return;
    const fetchSub = async () => {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan_type, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && data.plan_type !== 'free') {
        const isActive = !data.expires_at || new Date(data.expires_at) > new Date();
        setCurrentPlan(isActive ? data.plan_type : 'free');
        if (isActive && data.expires_at) {
          // Determine billing cycle from expires_at relative to started_at
          // If expires > 6 months from now, it's likely annual
          const expiresAt = new Date(data.expires_at);
          const now = new Date();
          const monthsLeft = (expiresAt.getFullYear() - now.getFullYear()) * 12 + (expiresAt.getMonth() - now.getMonth());
          setCurrentBillingCycle(monthsLeft > 2 ? 'annual' : 'monthly');
        }
      }
    };
    fetchSub();
  }, [user]);

  const getPrice = (planId: string) => {
    const p = pricing[planId];
    if (planId === 'free') return { main: 'Gratuito', sub: '', amount: 0 };
    if (billing === 'annual') {
      return { main: p.annualMonthly, sub: '/mês', amount: p.annual };
    }
    return { main: `R$${p.monthly.toFixed(2).replace('.', ',')}`, sub: '/mês', amount: p.monthly };
  };

  const requestDowngrade = async (planId: string) => {
    if (!user) return;
    // Fetch current expiration for confirmation dialog
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setDowngradeConfirm({ targetPlan: planId, expiresAt: sub?.expires_at || null });
  };

  const confirmDowngrade = async () => {
    if (!user || !downgradeConfirm) return;
    const planId = downgradeConfirm.targetPlan;
    setDowngradeConfirm(null);
    setDowngradingPlan(planId);
    try {
      if (planId === 'free') {
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ plan_type: 'free', expires_at: null, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
        setCurrentPlan('free');
        setCurrentBillingCycle(null);
        toast({ title: 'Plano alterado para Gratuito', description: 'Seu plano foi atualizado com sucesso.' });
      } else {
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ plan_type: planId, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
        setCurrentPlan(planId);
        toast({ title: 'Plano alterado para Vendedor Plus', description: 'Seu plano foi atualizado. Você mantém o período restante.' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao alterar plano', description: err.message, variant: 'destructive' });
    } finally {
      setDowngradingPlan(null);
    }
  };

  // Features lost when downgrading
  const getLostFeatures = (fromPlan: string, toPlan: string): string[] => {
    if (fromPlan === 'loja' && toPlan === 'plus') {
      return ['Anúncios ilimitados (volta para 50)', 'Upload em lote', 'Dashboard completo', 'Cupom de desconto', 'Badge "Loja Oficial"', 'Suporte prioritário'];
    }
    if (fromPlan === 'loja' && toPlan === 'free') {
      return ['Anúncios ilimitados (volta para 10)', 'Upload em lote', 'Dashboard completo', 'Cupom de desconto', 'Badge "Loja Oficial"', 'Suporte prioritário', 'Selo "Vendedor Verificado"', 'Destaque grátis mensal'];
    }
    if (fromPlan === 'plus' && toPlan === 'free') {
      return ['Até 50 anúncios (volta para 10)', '10 fotos por produto (volta para 5)', 'Destaque grátis mensal', 'Selo "Vendedor Verificado"'];
    }
    return [];
  };

  const handleBuyPlan = async (planId: string, paymentMethod: 'pix' | 'credit_card') => {
    if (!user) {
      toast({ title: 'Faça login para continuar', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    const amount = billing === 'annual' ? pricing[planId].annual : pricing[planId].monthly;
    const planLabel = planId === 'plus' ? 'Vendedor Plus' : 'Loja Oficial';
    const cycleLabel = billing === 'annual' ? 'Anual' : 'Mensal';

    if (paymentMethod === 'credit_card') {
      setCardModal({
        open: true,
        planType: planId,
        billingCycle: billing,
        amount,
      });
      return;
    }

    // PIX flow
    setBuyingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-plan-payment', {
        body: { plan_type: planId, billing_cycle: billing },
      });

      if (error || !data?.success) {
        toast({
          title: 'Erro ao gerar pagamento',
          description: data?.error || error?.message || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      setPixModal({
        open: true,
        paymentId: data.paymentId,
        qrcodeUrl: data.qrcode_url || '',
        payload: data.payload,
        expiration: data.expiration,
        amount: data.amount,
        planType: planId,
        billingCycle: billing,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PIX', description: err.message, variant: 'destructive' });
    } finally {
      setBuyingPlan(null);
    }
  };

  const refetchSubscription = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan_type, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data && data.plan_type !== 'free') {
      const isActive = !data.expires_at || new Date(data.expires_at) > new Date();
      setCurrentPlan(isActive ? data.plan_type : 'free');
      if (isActive && data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const monthsLeft = (expiresAt.getFullYear() - now.getFullYear()) * 12 + (expiresAt.getMonth() - now.getMonth());
        setCurrentBillingCycle(monthsLeft > 2 ? 'annual' : 'monthly');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-effect border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-lg font-semibold text-foreground">Planos</h1>
          {currentPlan !== 'free' && (
            <Badge variant="secondary" className="ml-auto text-xs">{currentPlan === 'loja' ? 'Loja Oficial' : currentPlan === 'plus' ? 'Plus' : currentPlan}</Badge>
          )}
        </div>
      </div>

      <div className="px-4 py-8 max-w-4xl mx-auto space-y-8 animate-fade-up">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Escolha o plano ideal para você
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Comece gratuitamente e evolua conforme sua loja cresce.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full bg-olive-warm p-1 gap-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                billing === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
                billing === 'annual'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              <Badge className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0">
                -20%
              </Badge>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan, index) => {
            const price = getPrice(plan.id);
            const annualTotal = `R$${pricing[plan.id].annual.toFixed(2).replace('.', ',')}`;
            const discount = pricing[plan.id].discount;
            const isCurrentPlan = currentPlan === plan.id && currentBillingCycle === billing;
            const isFree = plan.id === 'free';
            const isDowngrade = (currentPlan === 'loja' && plan.id === 'plus') || (currentPlan !== 'free' && plan.id === 'free');
            const isUpgrade = !isFree && !isCurrentPlan && !isDowngrade;
            const isBuying = buyingPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] ${
                  plan.highlighted
                    ? 'border-primary bg-card shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.15)]'
                    : 'border-border/50 bg-card shadow-[var(--shadow-card)]'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {plan.popularLabel && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground border-0 px-3 py-1 text-xs font-medium shadow-sm">
                      {plan.popularLabel}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-display text-xl font-semibold text-foreground">{plan.name}</h3>
                  {isCurrentPlan && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Atual</Badge>
                  )}
                </div>

                <div className="mb-6 min-h-[60px]">
                  <div key={billing} className="animate-scale-in">
                    <span className="text-3xl font-bold text-foreground">{price.main}</span>
                    {price.sub && <span className="text-sm text-muted-foreground">{price.sub}</span>}
                  </div>
                  {billing === 'annual' && !isFree && (
                    <div key={`annual-${billing}`} className="animate-fade-in mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{annualTotal}/ano</span>
                      <Badge className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0">{discount}</Badge>
                    </div>
                  )}
                  {billing === 'monthly' && !isFree && (
                    <div className="mt-1">
                      <span className="text-xs text-muted-foreground">cobrado mensalmente</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm text-foreground/80">{feature.text}</span>
                    </li>
                  ))}
                </ul>

                {/* Buttons */}
                {isCurrentPlan ? (
                  <Button className="w-full rounded-xl" variant="secondary" disabled>
                    Plano Atual
                  </Button>
                ) : isFree && currentPlan === 'free' ? (
                  <Button className="w-full rounded-xl" variant="secondary" disabled>
                    Plano Gratuito
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    className="w-full rounded-xl"
                    variant="outline"
                    disabled={downgradingPlan === plan.id}
                    onClick={() => requestDowngrade(plan.id)}
                  >
                    {downgradingPlan === plan.id ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Alterando...</>
                    ) : (
                      <><ArrowDown className="w-4 h-4 mr-2" /> Fazer Downgrade</>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      className="w-full rounded-xl"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      disabled={isBuying}
                      onClick={() => handleBuyPlan(plan.id, 'pix')}
                    >
                      {isBuying ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando PIX...</>
                      ) : (
                        'Pagar com PIX'
                      )}
                    </Button>
                    <Button
                      className="w-full rounded-xl"
                      variant="outline"
                      onClick={() => handleBuyPlan(plan.id, 'credit_card')}
                    >
                      Pagar com Cartão
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="space-y-4 pb-8">
          <div className="flex items-center gap-2 justify-center">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold text-foreground">Perguntas Frequentes</h3>
          </div>

          <div className="card-premium p-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="1" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Posso mudar de plano a qualquer momento?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade do seu plano quando quiser. As mudanças entram em vigor imediatamente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="2" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  O que acontece com meus anúncios se eu fizer downgrade?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Seus anúncios existentes continuam ativos, mas você não poderá criar novos até estar dentro do limite do plano escolhido.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="3" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Como funciona o destaque de produto?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Produtos em destaque aparecem com prioridade nos resultados de busca e na página inicial, aumentando a visibilidade para compradores.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="4" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Existe fidelidade ou contrato?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Não! Todos os planos são sem fidelidade. Você pode cancelar quando quiser sem custos adicionais.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="5" className="border-border/50 border-b-0">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  O selo "Vendedor Verificado" é permanente?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  O selo fica ativo enquanto você mantiver o plano Vendedor Plus ou superior. Ele aparece no seu perfil e em todos os seus anúncios.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Downgrade Confirmation Dialog */}
      <AlertDialog open={!!downgradeConfirm} onOpenChange={(open) => { if (!open) setDowngradeConfirm(null); }}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Confirmar downgrade</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Ao mudar para <span className="font-semibold text-foreground">{downgradeConfirm?.targetPlan === 'free' ? 'Gratuito' : 'Vendedor Plus'}</span>, você perderá acesso a:
                </p>
                <ul className="text-left space-y-2 bg-destructive/5 rounded-xl p-4">
                  {downgradeConfirm && getLostFeatures(currentPlan, downgradeConfirm.targetPlan).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-destructive mt-0.5">✕</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {downgradeConfirm?.expiresAt && downgradeConfirm.targetPlan !== 'free' && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
                    Seu período pago continua ativo até <span className="font-semibold text-foreground">{new Date(downgradeConfirm.expiresAt).toLocaleDateString('pt-BR')}</span>
                  </p>
                )}
                {downgradeConfirm?.targetPlan === 'free' && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
                    A alteração é imediata. Seu plano pago será cancelado agora.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogCancel className="rounded-xl w-full">Manter plano atual</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDowngrade} className="rounded-xl w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Confirmar downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIX Payment Modal */}
      {pixModal && (
        <PixPaymentModal
          open={pixModal.open}
          onOpenChange={(open) => { if (!open) setPixModal(null); }}
          paymentId={pixModal.paymentId}
          qrcodeUrl={pixModal.qrcodeUrl}
          payload={pixModal.payload}
          expiration={pixModal.expiration}
          amount={pixModal.amount}
          label={`Plano ${pixModal.planType === 'plus' ? 'Vendedor Plus' : 'Loja Oficial'} ${pixModal.billingCycle === 'annual' ? 'Anual' : 'Mensal'}`}
          paymentTable="plan_payments"
          onConfirmed={refetchSubscription}
        />
      )}

      {/* Credit Card Payment Modal */}
      {cardModal && (
        <CreditCardPaymentModal
          open={cardModal.open}
          onOpenChange={(open) => { if (!open) setCardModal(null); }}
          amount={cardModal.amount}
          label={`Plano ${cardModal.planType === 'plus' ? 'Vendedor Plus' : 'Loja Oficial'} ${cardModal.billingCycle === 'annual' ? 'Anual' : 'Mensal'}`}
          edgeFunctionName="create-plan-payment-card"
          edgeFunctionBody={{ plan_type: cardModal.planType, billing_cycle: cardModal.billingCycle }}
          onConfirmed={refetchSubscription}
        />
      )}
    </div>
  );
}
