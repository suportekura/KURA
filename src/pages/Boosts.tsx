import { ArrowLeft, Clock, Flame, Rocket, MousePointerClick, Eye, TrendingUp, HelpCircle, Package, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PixPaymentModal } from '@/components/boost/PixPaymentModal';
import { CreditCardPaymentModal } from '@/components/boost/CreditCardPaymentModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface BoostOption {
  type: 'single' | 'monthly';
  boostType: '24h' | '3d' | '7d';
  description: string;
  price: string;
  priceNote?: string;
  savings?: string;
  savingsNote?: string;
  strategicNote?: string;
  buttonText: string;
  highlighted?: boolean;
}

interface BoostTab {
  id: string;
  label: string;
  icon: React.ElementType;
  subtitle: string;
  options: BoostOption[];
}

const tabs: BoostTab[] = [
  {
    id: '24h',
    label: '24h',
    icon: Clock,
    subtitle: 'Seu anúncio sobe para o topo da categoria por 24 horas.',
    options: [
      {
        type: 'single',
        boostType: '24h',
        description: '1 impulsionamento (24h)',
        price: 'R$5,00',
        buttonText: 'Comprar',
      },
      {
        type: 'monthly',
        boostType: '24h',
        description: '5 impulsionamentos de 24h',
        price: 'R$19,90',
        savings: 'Economia de R$5,10 (~20%)',
        savingsNote: 'Comprando avulso: 5 × R$5,00 = R$25,00',
        buttonText: 'Comprar Pacote',
        highlighted: true,
      },
    ],
  },
  {
    id: '3d',
    label: '3 dias',
    icon: Flame,
    subtitle: 'Mais visibilidade contínua durante 3 dias.',
    options: [
      {
        type: 'single',
        boostType: '3d',
        description: '1 impulsionamento (3 dias)',
        price: 'R$9,90',
        buttonText: 'Comprar',
      },
      {
        type: 'monthly',
        boostType: '3d',
        description: '5 impulsionamentos de 3 dias',
        price: 'R$39,90',
        savings: 'Economia de R$9,60 (~19%)',
        savingsNote: 'Comprando avulso: 5 × R$9,90 = R$49,50',
        buttonText: 'Comprar Pacote',
        highlighted: true,
      },
    ],
  },
  {
    id: '7d',
    label: '7 dias',
    icon: Rocket,
    subtitle: 'Máxima exposição por 7 dias consecutivos.',
    options: [
      {
        type: 'single',
        boostType: '7d',
        description: '1 impulsionamento (7 dias)',
        price: 'R$14,90',
        buttonText: 'Comprar',
      },
      {
        type: 'monthly',
        boostType: '7d',
        description: '5 impulsionamentos de 7 dias',
        price: 'R$59,90',
        savings: 'Economia de R$14,60 (~20%)',
        savingsNote: 'Comprando avulso: 5 × R$14,90 = R$74,50',
        strategicNote: 'Ideal para manter presença constante.',
        buttonText: 'Comprar Pacote',
        highlighted: true,
      },
    ],
  },
];

export default function Boosts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('24h');
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; title: string; image: string | null } | null>(null);
  const [activatingBoost, setActivatingBoost] = useState<string | null>(null);
  const [boostCredits, setBoostCredits] = useState<{ '24h': number; '3d': number; '7d': number } | null>(null);
  const [pixModal, setPixModal] = useState<{
    open: boolean;
    paymentId: string;
    qrcode: string;
    qrcodeUrl: string;
    payload: string;
    expiration: string;
    amount: number;
    boostType: string;
  } | null>(null);
  const [buyingBoost, setBuyingBoost] = useState<string | null>(null); // format: "boostType_optionType" e.g. "24h_monthly"
  const [cardModal, setCardModal] = useState<{
    open: boolean;
    boostType: string;
    amount: number;
    quantity: number;
  } | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch product info if ?product= param is present
  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId || !user) return;

    const fetchProduct = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, title, images')
        .eq('id', productId)
        .eq('seller_id', user.id)
        .maybeSingle();

      if (data) {
        setSelectedProduct({
          id: data.id,
          title: data.title,
          image: data.images?.[0] || null,
        });
      }
    };

    fetchProduct();
  }, [searchParams, user]);

  // Fetch available boost credits
  useEffect(() => {
    if (!user) return;

    const fetchBoosts = async () => {
      const { data } = await supabase
        .from('user_boosts')
        .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setBoostCredits({
          '24h': data.total_boosts_24h - data.used_boosts_24h,
          '3d': data.total_boosts_3d - data.used_boosts_3d,
          '7d': data.total_boosts_7d - data.used_boosts_7d,
        });
      } else {
        setBoostCredits({ '24h': 0, '3d': 0, '7d': 0 });
      }
    };

    fetchBoosts();
  }, [user]);

  const handleActivateBoost = async (option: BoostOption, paymentMethod?: 'pix' | 'credit_card') => {
    if (!user) {
      toast({ title: 'Faça login para continuar', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    // Parse the actual price from the option
    const optionPrice = parseFloat(option.price.replace('R$', '').replace(',', '.'));
    const quantity = option.type === 'monthly' ? 5 : 1;

    // Credit card — open card form modal
    if (paymentMethod === 'credit_card') {
      setCardModal({
        open: true,
        boostType: option.boostType,
        amount: optionPrice,
        quantity,
      });
      return;
    }

    // If no product selected, this is a credit purchase via PIX
    if (!selectedProduct) {
      setBuyingBoost(`${option.boostType}_${option.type}`);
      try {
        const { data, error } = await supabase.functions.invoke('create-boost-payment', {
          body: { boost_type: option.boostType, quantity, amount_override: optionPrice },
        });

        if (error || !data?.success) {
          toast({ 
            title: 'Erro ao gerar pagamento', 
            description: data?.error || error?.message || 'Tente novamente.', 
            variant: 'destructive' 
          });
          return;
        }

        setPixModal({
          open: true,
          paymentId: data.paymentId,
          qrcode: data.qrcode || '',
          qrcodeUrl: data.qrcode_url || data.qrcode || '',
          payload: data.payload,
          expiration: data.expiration,
          amount: data.amount,
          boostType: option.boostType,
        });
      } catch (err: any) {
        toast({ title: 'Erro ao gerar PIX', description: err.message, variant: 'destructive' });
      } finally {
        setBuyingBoost(null);
      }
      return;
    }

    // Product selected — activate boost using existing credits
    setActivatingBoost(option.boostType);

    try {
      const { data, error } = await supabase.rpc('activate_product_boost', {
        p_product_id: selectedProduct.id,
        p_boost_type: option.boostType,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string; expires_at?: string; remaining_boosts?: number };

      if (!result.success) {
        toast({ title: 'Não foi possível impulsionar', description: result.error, variant: 'destructive' });
        return;
      }

      // Re-fetch to get accurate counts
      const { data: freshData } = await supabase
        .from('user_boosts')
        .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
        .eq('user_id', user.id)
        .maybeSingle();
      if (freshData) {
        setBoostCredits({
          '24h': freshData.total_boosts_24h - freshData.used_boosts_24h,
          '3d': freshData.total_boosts_3d - freshData.used_boosts_3d,
          '7d': freshData.total_boosts_7d - freshData.used_boosts_7d,
        });
      }

      toast({
        title: 'Anúncio impulsionado! 🚀',
        description: `"${selectedProduct.title}" está no topo até ${new Date(result.expires_at!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao impulsionar', description: err.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setActivatingBoost(null);
    }
  };

  const refetchCredits = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_boosts')
      .select('total_boosts_24h, used_boosts_24h, total_boosts_3d, used_boosts_3d, total_boosts_7d, used_boosts_7d')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setBoostCredits({
        '24h': data.total_boosts_24h - data.used_boosts_24h,
        '3d': data.total_boosts_3d - data.used_boosts_3d,
        '7d': data.total_boosts_7d - data.used_boosts_7d,
      });
    }
  }, [user]);

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-effect border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-lg font-semibold text-foreground">Boosts</h1>
          {boostCredits !== null && (
            <div className="ml-auto flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">24h: {boostCredits['24h']}</Badge>
              <Badge variant="secondary" className="text-xs">3d: {boostCredits['3d']}</Badge>
              <Badge variant="secondary" className="text-xs">7d: {boostCredits['7d']}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-8 max-w-4xl mx-auto space-y-8 animate-fade-up">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-foreground">
            Impulsione seus anúncios
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Escolha o período e compare avulso vs pacote econômico.
          </p>
        </div>

        {/* Selected Product Banner */}
        {selectedProduct && (
          <div className="card-premium p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex-shrink-0">
              {selectedProduct.image ? (
                <img src={selectedProduct.image} alt={selectedProduct.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Impulsionando</p>
              <p className="text-sm font-medium text-foreground truncate">{selectedProduct.title}</p>
            </div>
            <button
              onClick={() => {
                setSelectedProduct(null);
                navigate('/boosts', { replace: true });
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Alterar
            </button>
          </div>
        )}

        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full bg-olive-warm p-1 gap-1">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtitle for active tab */}
        <p className="text-center text-xs text-muted-foreground">{currentTab.subtitle}</p>

        {/* Cards */}
        <div key={activeTab} className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-scale-in">
          {currentTab.options.map((option) => {
            const buyingKey = `${option.boostType}_${option.type}`;
            const isLoading = activatingBoost === option.boostType && option.type === 'single';
            const isBuying = buyingBoost === buyingKey;

            return (
              <div
                key={option.type}
                className={`relative rounded-2xl border p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  option.highlighted
                    ? 'border-primary bg-card shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.15)]'
                    : 'border-border/50 bg-card shadow-[var(--shadow-card)]'
                }`}
              >
                {/* Best value badge */}
                {option.highlighted && option.savings && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground border-0 px-3 py-1 text-xs font-medium shadow-sm">
                      Melhor custo-benefício
                    </Badge>
                  </div>
                )}

                {/* Label */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {option.type === 'single' ? 'Avulso' : 'Pacote Econômico (5 impulsos)'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-foreground/80 mb-4">{option.description}</p>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-2xl font-bold text-foreground">{option.price}</span>
                  {option.priceNote && (
                    <span className="text-sm text-muted-foreground">{option.priceNote}</span>
                  )}
                </div>

                {/* Savings info */}
                {option.savingsNote && (
                  <div className="mb-4 p-3 rounded-xl bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">{option.savingsNote}</p>
                    <p className="text-xs font-semibold text-primary">{option.savings}</p>
                  </div>
                )}

                {/* Strategic note */}
                {option.strategicNote && (
                  <div className="mb-4 p-3 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground italic">{option.strategicNote}</p>
                  </div>
                )}

                {/* Buttons */}
                <div className="mt-auto space-y-2">
                  {selectedProduct && option.type === 'single' ? (
                    <>
                      <Button
                        className="w-full rounded-xl"
                        variant="default"
                        disabled={isLoading || (boostCredits !== null && boostCredits[option.boostType] === 0)}
                        onClick={() => handleActivateBoost(option)}
                      >
                        {isLoading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Impulsionando...</>
                        ) : (
                          'Usar crédito e impulsionar'
                        )}
                      </Button>
                      {boostCredits !== null && boostCredits[option.boostType] === 0 && (
                        <p className="text-xs text-center text-muted-foreground">
                          Você não tem créditos disponíveis
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full rounded-xl"
                        variant={option.highlighted ? 'default' : 'outline'}
                        disabled={isBuying}
                        onClick={() => handleActivateBoost(option, 'pix')}
                      >
                        {isBuying ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando PIX...</>
                        ) : (
                          <>Comprar no Pix</>
                        )}
                      </Button>
                      <Button
                        className="w-full rounded-xl"
                        variant="outline"
                        disabled={activatingBoost === option.boostType}
                        onClick={() => handleActivateBoost(option, 'credit_card')}
                      >
                        {activatingBoost === option.boostType ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                        ) : (
                          <>Comprar no Cartão de Crédito</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Como Funciona */}
        <div className="card-premium p-6 space-y-5">
          <h3 className="font-display text-lg font-semibold text-foreground text-center">Como funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: MousePointerClick, step: '1', title: 'Escolha o boost', desc: 'Selecione o tipo de impulsionamento e a duração ideal para o seu anúncio.' },
              { icon: Eye, step: '2', title: 'Ganhe visibilidade', desc: 'Seu anúncio sobe para o topo da categoria e ganha destaque imediato.' },
              { icon: TrendingUp, step: '3', title: 'Venda mais rápido', desc: 'Com mais visualizações, suas chances de venda aumentam significativamente.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                    {item.step}
                  </span>
                </div>
                <h4 className="font-display text-sm font-semibold text-foreground">{item.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
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
                  O que acontece quando meu boost expira?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Seu anúncio volta à posição normal no feed. Você pode comprar outro boost a qualquer momento para voltar ao topo.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="2" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Posso impulsionar mais de um anúncio ao mesmo tempo?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Sim! Cada boost é aplicado individualmente a um anúncio. Você pode impulsionar quantos anúncios quiser simultaneamente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="3" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Os créditos do pacote econômico acumulam?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Sim! Se você comprar mais créditos do mesmo tipo, eles acumulam com os que você já tem.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="4" className="border-border/50">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  Meus créditos de boost expiram se eu não usar?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  Não! Créditos de boost não têm validade. Você pode comprar hoje e usar daqui a meses — eles ficam na sua conta até serem consumidos.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="5" className="border-border/50 border-b-0">
                <AccordionTrigger className="px-4 text-sm font-medium text-foreground hover:no-underline text-left">
                  O boost garante a venda do meu produto?
                </AccordionTrigger>
                <AccordionContent className="px-4 text-sm text-muted-foreground">
                  O boost aumenta significativamente a visibilidade do seu anúncio, mas a venda depende de fatores como preço, fotos e descrição do produto.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {/* PIX Payment Modal */}
      {pixModal && (
        <PixPaymentModal
          open={pixModal.open}
          onOpenChange={(open) => { if (!open) setPixModal(null); }}
          paymentId={pixModal.paymentId}
          qrcode={pixModal.qrcode}
          qrcodeUrl={pixModal.qrcodeUrl}
          payload={pixModal.payload}
          expiration={pixModal.expiration}
          amount={pixModal.amount}
          label={`Boost ${pixModal.boostType === '24h' ? '24 horas' : pixModal.boostType === '3d' ? '3 dias' : '7 dias'}`}
          paymentTable="boost_payments"
          onConfirmed={refetchCredits}
        />
      )}

      {cardModal && (
        <CreditCardPaymentModal
          open={cardModal.open}
          onOpenChange={(open) => { if (!open) setCardModal(null); }}
          amount={cardModal.amount}
          label={`Boost ${cardModal.boostType === '24h' ? '24 horas' : cardModal.boostType === '3d' ? '3 dias' : '7 dias'}`}
          edgeFunctionName="create-boost-payment-card"
          edgeFunctionBody={{ boost_type: cardModal.boostType, quantity: cardModal.quantity, amount_override: cardModal.amount }}
          onConfirmed={refetchCredits}
        />
      )}
    </div>
  );
}
