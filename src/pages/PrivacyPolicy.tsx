import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Lock, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-xl font-display font-semibold text-primary">Política de Privacidade</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Política de Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-6 text-muted-foreground">
              <section>
                <p>
                  Esta Política de Privacidade descreve como o Kura (kuralab.com.br) coleta, utiliza,
                  armazena, compartilha e protege os seus dados pessoais, em conformidade com a Lei
                  Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD). Ao criar uma conta
                  ou utilizar a plataforma, você declara estar ciente das práticas aqui descritas.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Quem é o controlador dos dados</h3>
                <p>
                  O Kura é uma plataforma de marketplace para compra e venda de peças de vestuário e
                  acessórios de segunda mão (brechó online) entre pessoas físicas (PF) e pessoas
                  jurídicas (PJ). O Kura atua como controlador dos dados pessoais tratados na plataforma.
                  Para questões relativas à privacidade, ou para falar com nosso Encarregado pelo
                  Tratamento de Dados (DPO), utilize o e-mail{' '}
                  <span className="text-primary font-medium">privacidade@kuralab.com.br</span>.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Dados que coletamos</h3>
                <p><strong className="text-foreground">2.1. Dados fornecidos por você</strong></p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Dados de cadastro: nome completo, nome de exibição, e-mail e senha;</li>
                  <li>Dados de identificação: CPF e idade (vendedores PF) ou CNPJ e razão social (vendedores PJ);</li>
                  <li>Dados de contato e endereço: telefone, endereço e CEP;</li>
                  <li>Dados de recebimento: chave PIX (opcional, informada pelo vendedor);</li>
                  <li>Conteúdo de anúncios: fotos, títulos, descrições, preços e demais informações das peças;</li>
                  <li>Conteúdo de comunicação: mensagens, ofertas, avaliações e interações com outros usuários e com o suporte.</li>
                </ul>
                <p className="mt-3"><strong className="text-foreground">2.2. Dados coletados automaticamente</strong></p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Localização geográfica aproximada (latitude e longitude), quando autorizada;</li>
                  <li>Dados de uso: produtos visualizados, buscas, favoritos, seguidores e histórico de navegação na plataforma;</li>
                  <li>Dados técnicos do dispositivo e do navegador necessários ao funcionamento e à segurança do serviço.</li>
                </ul>
                <p className="mt-3"><strong className="text-foreground">2.3. Dados de terceiros</strong></p>
                <p>
                  Caso você opte por entrar com sua conta Google, recebemos do provedor apenas o seu
                  nome e e-mail. Não temos acesso à sua senha do Google.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Como e por que usamos seus dados</h3>
                <p>Tratamos seus dados pessoais para as seguintes finalidades, com base nas hipóteses legais previstas na LGPD (execução de contrato, cumprimento de obrigação legal, legítimo interesse e consentimento):</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Criar e gerenciar sua conta e autenticar seu acesso;</li>
                  <li>Permitir a publicação de anúncios e a intermediação de contato entre compradores e vendedores;</li>
                  <li>Exibir produtos e vendedores próximos a você e calcular distâncias;</li>
                  <li>Processar o pagamento de serviços contratados do Kura (planos e destaques/boosts);</li>
                  <li>Moderar conteúdo para garantir a segurança e a conformidade da plataforma;</li>
                  <li>Enviar comunicações e notificações relevantes sobre sua conta, pedidos e mensagens;</li>
                  <li>Prevenir fraudes, abusos e atividades ilegais;</li>
                  <li>Cumprir obrigações legais e regulatórias.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Segurança dos dados</h3>
                <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                  <Lock className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <p>Seus dados sensíveis (CPF, CNPJ e chave PIX) são criptografados com padrão avançado (AES-256-GCM) antes de serem armazenados, e nunca são exibidos publicamente nem compartilhados com terceiros não autorizados. Adotamos medidas técnicas e organizacionais para proteger seus dados contra acessos não autorizados, perda ou destruição.</p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Compartilhamento de dados</h3>
                <p>Não vendemos seus dados pessoais e não os compartilhamos para fins de marketing de terceiros. O compartilhamento ocorre apenas nas seguintes situações:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li><strong className="text-foreground">Entre usuários:</strong> dados necessários para viabilizar uma transação (como nome de exibição e informações de contato combinadas pelo chat) são compartilhados entre comprador e vendedor;</li>
                  <li><strong className="text-foreground">Com operadores de serviços:</strong> empresas que processam dados em nosso nome, exclusivamente para a operação da plataforma (ver item 6);</li>
                  <li><strong className="text-foreground">Por obrigação legal:</strong> quando exigido por lei, ordem judicial ou autoridade competente;</li>
                  <li><strong className="text-foreground">Para proteção:</strong> para resguardar os direitos, a segurança e a integridade do Kura, de seus usuários e de terceiros.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Operadores e provedores de serviço</h3>
                <p>Para operar a plataforma, utilizamos provedores de serviço que podem tratar dados em nosso nome:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li><strong className="text-foreground">Supabase:</strong> infraestrutura de banco de dados, autenticação e armazenamento de arquivos;</li>
                  <li><strong className="text-foreground">Pagar.me:</strong> processamento de pagamentos de planos e destaques (PIX e cartão de crédito);</li>
                  <li><strong className="text-foreground">Google:</strong> login social (Google) e moderação de conteúdo por inteligência artificial (Gemini);</li>
                  <li><strong className="text-foreground">Resend:</strong> envio de e-mails transacionais (verificação de conta, recuperação de senha);</li>
                  <li><strong className="text-foreground">Upstash:</strong> controle de taxa de requisições (proteção contra abusos);</li>
                  <li><strong className="text-foreground">OpenStreetMap / Nominatim:</strong> conversão de coordenadas em nome de cidade (geocodificação reversa).</li>
                </ul>
                <p className="mt-2">Alguns desses provedores podem estar localizados fora do Brasil. Nesses casos, a transferência internacional de dados é realizada com as salvaguardas previstas na LGPD.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Pagamentos</h3>
                <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <p>O pagamento das peças anunciadas é combinado e realizado diretamente entre comprador e vendedor — o Kura não intermedia nem processa o pagamento dos produtos e não armazena dados de cartão dos usuários. O Kura processa apenas o pagamento dos seus próprios serviços (planos de assinatura e destaques/boosts), por meio do provedor Pagar.me. Os dados de cartão são tokenizados pelo provedor de pagamento e nunca são armazenados pelo Kura.</p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">8. Câmera e fotos</h3>
                <p>O Kura acessa sua câmera e biblioteca de fotos exclusivamente para que você fotografe e faça upload das peças que deseja vender. As imagens são enviadas ao nosso servidor e armazenadas de forma segura, ficando visíveis aos demais usuários interessados no produto anunciado. Não utilizamos suas fotos para outras finalidades.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">9. Localização</h3>
                <p>Coletamos sua localização geográfica (latitude e longitude) para exibir produtos disponíveis próximos a você e calcular distâncias. A localização é arredondada (~11m de precisão) para proteger sua privacidade, e as coordenadas exatas nunca são expostas publicamente. Usuários autenticados têm a localização armazenada de forma associada à conta; usuários não autenticados têm a localização salva apenas no próprio dispositivo (localStorage). Você pode recusar ou revogar o compartilhamento de localização a qualquer momento nas configurações do dispositivo ou do navegador.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">10. Inteligência artificial e moderação</h3>
                <p>O Kura utiliza a API Google Gemini para moderar imagens e textos enviados à plataforma, verificando a conformidade com nossas políticas (por exemplo, bloqueio de capturas de tela, conteúdo que não seja de produtos e conteúdo impróprio). As imagens e descrições dos anúncios são enviadas à API do Google para análise automatizada. Não enviamos dados de identificação pessoal (como CPF, CNPJ ou chave PIX) nesse processo. Consulte a Política de Privacidade do Google para detalhes sobre como esses dados são processados.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">11. Login social</h3>
                <p>Você pode se cadastrar e autenticar utilizando sua conta Google. Ao usar esse provedor, coletamos apenas o nome e o e-mail por ele fornecidos. Não armazenamos a senha da sua conta Google. Consulte a Política de Privacidade do Google para mais detalhes. Outros provedores de login social poderão ser disponibilizados futuramente.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">12. Notificações</h3>
                <p>Com a sua autorização, podemos enviar notificações push e in-app sobre mensagens, ofertas, status de pedidos e novidades da sua conta. Para isso, armazenamos as informações de inscrição (endpoint) do seu navegador/dispositivo. Você pode desativar as notificações a qualquer momento nas configurações do dispositivo ou do navegador.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">13. Cookies e armazenamento local</h3>
                <p>Utilizamos cookies e tecnologias de armazenamento local (localStorage) estritamente necessárias ao funcionamento da plataforma, tais como: manutenção da sessão de login, preferências de tema, conteúdo do carrinho e localização para usuários não autenticados. Esses dados ficam, em regra, armazenados no seu próprio dispositivo.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">14. Retenção de dados</h3>
                <p>Mantemos seus dados pessoais enquanto sua conta estiver ativa ou pelo tempo necessário para cumprir as finalidades descritas nesta Política. Após a exclusão da conta, podemos reter determinados dados pelo período exigido para o cumprimento de obrigações legais, regulatórias, contábeis ou para resolução de disputas.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">15. Seus direitos</h3>
                <p>De acordo com a LGPD, você tem direito a:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Confirmar a existência de tratamento e acessar seus dados pessoais;</li>
                  <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
                  <li>Solicitar a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
                  <li>Solicitar a portabilidade dos seus dados;</li>
                  <li>Solicitar a eliminação dos dados tratados com base no seu consentimento;</li>
                  <li>Obter informações sobre o compartilhamento dos seus dados;</li>
                  <li>Revogar o consentimento a qualquer momento.</li>
                </ul>
                <p className="mt-2">Para exercer seus direitos, entre em contato pelo e-mail <span className="text-primary font-medium">privacidade@kuralab.com.br</span>.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">16. Exclusão de conta</h3>
                <p>Você pode solicitar a exclusão da sua conta a qualquer momento, diretamente em <strong className="text-foreground">Configurações → Excluir conta</strong>. A exclusão remove seus dados pessoais e desativa seus anúncios, sendo uma ação irreversível. Determinadas informações poderão ser retidas quando houver obrigação legal de guarda.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">17. Crianças e adolescentes</h3>
                <p>O Kura é destinado exclusivamente a maiores de 18 anos. Não coletamos intencionalmente dados de menores de idade. Caso identifiquemos uma conta criada por menor de 18 anos, ela poderá ser suspensa ou removida.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">18. Alterações nesta Política</h3>
                <p>Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças na plataforma ou na legislação. A versão vigente estará sempre disponível nesta página, com a respectiva data de atualização. Recomendamos a revisão periódica deste documento.</p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">19. Contato</h3>
                <p>Para questões sobre privacidade ou para exercer seus direitos, fale com nosso Encarregado pelo Tratamento de Dados (DPO) pelo e-mail <span className="text-primary font-medium">privacidade@kuralab.com.br</span>. Para suporte geral, utilize <span className="text-primary font-medium">suporte@kuralab.com.br</span>.</p>
              </section>
            </div>
          </CardContent>
        </Card>
        <div className="text-center text-sm text-muted-foreground">
          <p>Última atualização: Junho de 2026</p>
        </div>
      </main>
    </div>
  );
}
