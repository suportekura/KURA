import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-2">
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
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Coleta de Dados</h3>
                <p>Coletamos informações necessárias para o funcionamento da plataforma, incluindo:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Dados de identificação (nome, e-mail, CPF/CNPJ)</li>
                  <li>Informações de endereço para entrega</li>
                  <li>Dados de pagamento (chave PIX)</li>
                  <li>Informações de uso da plataforma</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Segurança dos Dados</h3>
                <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                  <Lock className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <p>Seus dados sensíveis (CPF, CNPJ, chave PIX) são criptografados utilizando padrões de segurança avançados (AES-256) e nunca são expostos ou compartilhados com terceiros não autorizados.</p>
                </div>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Uso dos Dados</h3>
                <p>Utilizamos seus dados para:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Processar transações e pagamentos</li>
                  <li>Melhorar a experiência do usuário na plataforma</li>
                  <li>Enviar comunicações importantes sobre sua conta</li>
                  <li>Prevenir fraudes e atividades ilegais</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Compartilhamento de Dados</h3>
                <p>Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Podemos compartilhar dados apenas quando:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Necessário para completar uma transação entre usuários</li>
                  <li>Exigido por lei ou ordem judicial</li>
                  <li>Para proteger os direitos e segurança da plataforma e seus usuários</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Câmera e Fotos</h3>
                <p>O Kura acessa sua câmera e biblioteca de fotos exclusivamente para que você fotografe e faça upload das peças que deseja vender. As imagens são enviadas ao nosso servidor e armazenadas de forma segura. Não compartilhamos suas fotos com terceiros além dos compradores interessados no produto anunciado.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Localização</h3>
                <p>Coletamos sua localização geográfica (latitude e longitude) para exibir produtos disponíveis próximos a você e calcular distâncias. A localização é arredondada (~11m de precisão) para proteger sua privacidade. Usuários autenticados têm a localização armazenada na tabela user_locations; usuários não autenticados têm a localização salva apenas no dispositivo (localStorage). Você pode recusar o compartilhamento de localização a qualquer momento nas configurações do dispositivo.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Inteligência Artificial e Moderação</h3>
                <p>O Kura utiliza a API Google Gemini para moderar imagens e textos enviados à plataforma, verificando a conformidade com nossas políticas de uso. As imagens e descrições dos produtos são enviadas à API do Google para análise. Não compartilhamos informações de identificação pessoal com o Google neste processo. Consulte a Política de Privacidade do Google para detalhes sobre como a Google processa esses dados.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">8. Login Social</h3>
                <p>Você pode se cadastrar e autenticar usando sua conta Google ou Apple. Ao usar esses provedores, coletamos apenas o nome e e-mail fornecidos pelo serviço. Não armazenamos senhas de contas Google ou Apple. Consulte as políticas de privacidade do Google e da Apple para detalhes.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">9. Seus Direitos</h3>
                <p>De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir dados incompletos ou desatualizados</li>
                  <li>Solicitar a exclusão de seus dados</li>
                  <li>Revogar o consentimento a qualquer momento</li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">10. Retenção de Dados</h3>
                <p>Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para cumprir obrigações legais, resolver disputas e fazer cumprir nossos acordos.</p>
              </section>
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">11. Contato</h3>
                <p>Para questões sobre privacidade ou para exercer seus direitos, entre em contato conosco através do e-mail: <span className="text-primary font-medium">privacidade@kuralab.com.br</span></p>
              </section>
            </div>
          </CardContent>
        </Card>
        <div className="text-center text-sm text-muted-foreground">
          <p>Última atualização: Abril de 2026</p>
        </div>
      </main>
    </div>
  );
}
