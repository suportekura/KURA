import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  // Quando o usuário chega direto pelo link de compartilhamento, não há
  // histórico de navegação dentro do app (window.history.state.idx === 0),
  // então navigate(-1) o deixaria preso ou fora do app. Nesse caso, manda
  // para a home; caso contrário, volta normalmente para a página anterior.
  const handleBack = () => {
    const hasAppHistory = (window.history.state?.idx ?? 0) > 0;
    if (hasAppHistory) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-xl font-display font-semibold text-primary">
            Termos de Uso
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Terms of Use */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <FileText className="h-6 w-6 text-primary" />
              Termos de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-6 text-muted-foreground">
              <section>
                <p>
                  Estes Termos de Uso regulam o acesso e a utilização da plataforma Kura
                  (kuralab.com.br). Ao criar uma conta ou utilizar o Kura, você concorda integralmente
                  com estes Termos. Leia-os com atenção. Caso não concorde com qualquer disposição,
                  não utilize a plataforma.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Aceitação dos Termos</h3>
                <p>
                  Ao acessar e utilizar a plataforma Kura, você concorda em cumprir e estar vinculado a
                  estes Termos de Uso e à nossa Política de Privacidade. Se você não concordar com
                  qualquer parte destes termos, não deverá utilizar nossos serviços.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Descrição do Serviço</h3>
                <p>
                  O Kura é uma plataforma de marketplace (brechó online) que conecta compradores e
                  vendedores de peças de vestuário e acessórios de segunda mão, de forma
                  geolocalizada. O Kura disponibiliza ferramentas de anúncio, busca, comunicação por
                  chat, ofertas e reputação.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3 mt-3">
                  <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <p>
                    <strong className="text-foreground">Importante:</strong> o Kura é apenas o
                    intermediador que aproxima as partes. As compras e vendas são realizadas
                    diretamente entre comprador e vendedor. O Kura não é parte do contrato de compra e
                    venda, não tem posse das peças, não processa o pagamento dos produtos e não realiza
                    a entrega das mercadorias.
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Elegibilidade</h3>
                <p>
                  Para utilizar nossos serviços, você deve ter pelo menos 18 anos de idade e possuir
                  plena capacidade civil para celebrar contratos vinculantes. Vendedores podem se
                  cadastrar como pessoa física (PF), mediante CPF, ou como pessoa jurídica (PJ),
                  mediante CNPJ.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Conta do Usuário</h3>
                <p>
                  Você é responsável por fornecer informações verdadeiras, completas e atualizadas no
                  cadastro, bem como por manter a confidencialidade de sua conta e senha. Qualquer
                  atividade realizada em sua conta será de sua responsabilidade. Notifique-nos
                  imediatamente em caso de uso não autorizado.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Anúncios e Conteúdo do Usuário</h3>
                <p>O vendedor é o único responsável pelo conteúdo que publica e declara que:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>É o legítimo proprietário das peças e tem o direito de vendê-las;</li>
                  <li>As fotos são reais, próprias e correspondem ao item efetivamente anunciado;</li>
                  <li>As descrições, preços, tamanhos e o estado de conservação são precisos e verdadeiros;</li>
                  <li>O conteúdo não viola direitos de terceiros nem a legislação vigente.</li>
                </ul>
                <p className="mt-2">
                  Ao publicar conteúdo, você concede ao Kura uma licença não exclusiva e gratuita para
                  exibir, reproduzir e divulgar esse conteúdo na plataforma e em seus canais, com a
                  finalidade de operar e promover o serviço.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Autenticidade dos Produtos e Itens Proibidos</h3>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                  <p className="text-amber-800 dark:text-amber-200">
                    <strong>Importante:</strong> o Kura preza pela autenticidade das peças. É
                    expressamente proibida a venda de réplicas, falsificações ou produtos de origem
                    duvidosa. Usuários que violarem esta regra terão suas contas suspensas
                    permanentemente.
                  </p>
                </div>
                <p className="mt-3">Também é proibido anunciar ou comercializar:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Produtos ilícitos, roubados ou de procedência ilegal;</li>
                  <li>Itens que violem direitos de propriedade intelectual de terceiros;</li>
                  <li>Conteúdo ofensivo, discriminatório, de cunho sexual ou que viole a dignidade de terceiros;</li>
                  <li>Quaisquer produtos cuja venda seja vedada pela legislação brasileira.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Moderação de Conteúdo</h3>
                <p>
                  Os anúncios e mensagens podem ser submetidos a moderação automatizada (inteligência
                  artificial) e/ou revisão humana. O Kura pode reprovar, ocultar ou remover conteúdos
                  que violem estes Termos, bem como suspender ou encerrar contas infratoras, a seu
                  critério e sem aviso prévio quando necessário para a segurança da plataforma.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">8. Transações, Pagamentos e Entrega entre Usuários</h3>
                <p>
                  As transações de produtos são realizadas diretamente entre comprador e vendedor. Ao
                  confirmar um pedido na plataforma, o item é reservado e as partes combinam, pelo chat,
                  a forma de pagamento e a retirada/entrega. Atualmente, a modalidade disponível é a
                  retirada combinada com o vendedor; outras modalidades de entrega poderão ser
                  disponibilizadas futuramente.
                </p>
                <p className="mt-2">
                  O Kura não recebe nem repassa valores referentes à compra e venda de produtos, não se
                  responsabiliza pela qualidade, autenticidade, entrega ou conformidade das peças, nem
                  por disputas financeiras entre as partes. O Kura poderá, contudo, oferecer suporte
                  para mediação quando cabível. Recomendamos que toda a negociação e combinação ocorra
                  dentro da plataforma.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">9. Responsabilidades do Vendedor</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Fornecer descrições precisas e fotos reais dos produtos;</li>
                  <li>Declarar corretamente o estado de conservação das peças;</li>
                  <li>Responder às mensagens dos compradores em tempo hábil;</li>
                  <li>Cumprir com os prazos e condições de entrega acordados;</li>
                  <li>Manter seus dados de recebimento corretos e cumprir suas obrigações fiscais aplicáveis.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">10. Responsabilidades do Comprador</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Verificar as informações do produto antes de confirmar o pedido;</li>
                  <li>Realizar o pagamento ao vendedor conforme combinado;</li>
                  <li>Comparecer ou combinar a retirada/entrega de boa-fé;</li>
                  <li>Comunicar qualquer problema com a compra, preferencialmente pelo chat da plataforma.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">11. Planos de Assinatura</h3>
                <p>
                  O Kura oferece planos de assinatura para vendedores, com diferentes níveis de
                  recursos (Free, Vendedor Plus e Loja Oficial). Os planos pagos são contratados em
                  ciclo mensal ou anual, com os valores informados na página de Planos no momento da
                  contratação. Não há fidelidade: você pode cancelar, fazer upgrade ou downgrade a
                  qualquer momento. Em caso de downgrade para um plano pago, o período já pago é
                  mantido até o vencimento; ao mudar para o plano gratuito, a alteração é imediata.
                  Os pagamentos são processados pelo provedor Pagar.me (PIX ou cartão de crédito).
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">12. Destaques (Boosts) e Cupons</h3>
                <p>
                  Os destaques (boosts) são serviços avulsos que aumentam a visibilidade de um anúncio
                  por um período determinado, mediante pagamento ao Kura via Pagar.me. Cupons de
                  desconto, quando disponibilizados por vendedores do plano Loja Oficial, aplicam-se
                  exclusivamente aos anúncios do respectivo vendedor, conforme as regras (validade,
                  limite de uso e aplicabilidade) definidas no cupom.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">13. Direito de Arrependimento e Reembolso</h3>
                <p>
                  Para a contratação de serviços do Kura (planos e destaques) realizada à distância,
                  você pode exercer o direito de arrependimento no prazo de 7 (sete) dias, nos termos
                  do art. 49 do Código de Defesa do Consumidor, desde que o serviço ainda não tenha
                  sido integralmente usufruído. As transações de produtos entre usuários não são
                  processadas pelo Kura e seguem o que for combinado entre comprador e vendedor.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">14. Avaliações e Reputação</h3>
                <p>
                  Após uma transação, comprador e vendedor podem avaliar um ao outro. As avaliações
                  devem ser verdadeiras, de boa-fé e respeitosas. O Kura pode remover avaliações que
                  violem estes Termos, contenham conteúdo ofensivo ou sejam manifestamente falsas.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">15. Conduta Proibida</h3>
                <p>É vedado ao usuário, entre outras condutas:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Praticar fraudes, golpes ou induzir outros usuários a erro;</li>
                  <li>Utilizar a plataforma para fins ilícitos ou que violem direitos de terceiros;</li>
                  <li>Burlar mecanismos de segurança, moderação ou de cobrança;</li>
                  <li>Coletar dados de outros usuários sem autorização;</li>
                  <li>Enviar spam, conteúdo abusivo, discriminatório ou de assédio.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">16. Propriedade Intelectual</h3>
                <p>
                  A marca Kura, o logotipo, o design, os textos e os demais elementos da plataforma são
                  de titularidade do Kura e protegidos pela legislação aplicável. É vedada a sua
                  utilização sem autorização prévia e expressa. O conteúdo publicado pelos usuários
                  permanece de titularidade deles, observada a licença de uso prevista no item 5.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">17. Suspensão e Encerramento</h3>
                <p>
                  O Kura poderá suspender ou encerrar contas que violem estes Termos, a legislação ou
                  que apresentem risco à segurança da plataforma e dos usuários. Você pode, a qualquer
                  momento, encerrar sua conta em Configurações → Excluir conta.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">18. Limitação de Responsabilidade</h3>
                <p>
                  Por atuar como intermediador, o Kura não garante a conclusão, a qualidade ou a
                  segurança das transações entre usuários, nem se responsabiliza por danos decorrentes
                  de condutas de terceiros. A plataforma é fornecida no estado em que se encontra,
                  podendo passar por manutenções, atualizações e indisponibilidades temporárias. Nada
                  nestes Termos exclui direitos que não possam ser limitados pela legislação aplicável.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">19. Alterações dos Termos</h3>
                <p>
                  Podemos atualizar estes Termos periodicamente. A versão vigente estará sempre
                  disponível nesta página, com a respectiva data de atualização. O uso continuado da
                  plataforma após alterações implica concordância com os novos Termos.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">20. Lei Aplicável e Foro</h3>
                <p>
                  Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do domicílio
                  do consumidor para dirimir eventuais controvérsias, ressalvadas as hipóteses de
                  competência legal específica.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">21. Contato</h3>
                <p>
                  Em caso de dúvidas sobre estes Termos, entre em contato pelo e-mail{' '}
                  <span className="text-primary font-medium">suporte@kuralab.com.br</span>. Para
                  assuntos de privacidade e proteção de dados, utilize{' '}
                  <span className="text-primary font-medium">privacidade@kuralab.com.br</span>.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Última atualização: Junho de 2026</p>
        </div>
      </main>
    </div>
  );
}
