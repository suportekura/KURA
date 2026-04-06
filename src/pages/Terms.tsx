import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, FileText, Lock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-xl font-display font-semibold text-primary">
            Termos de Uso e Política de Privacidade
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
            <p className="text-muted-foreground italic text-lg mb-6">
              Em revisão
            </p>
            
            <div className="space-y-6 text-muted-foreground">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Aceitação dos Termos</h3>
                <p>
                  Ao acessar e utilizar a plataforma Kura, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
                  Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">2. Descrição do Serviço</h3>
                <p>
                   O Kura é uma plataforma de marketplace focada em peças únicas, permitindo que usuários comprem e vendam 
                   peças de vestuário e acessórios de forma geolocalizada.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">3. Elegibilidade</h3>
                <p>
                  Para utilizar nossos serviços, você deve ter pelo menos 18 anos de idade e possuir capacidade legal para 
                  celebrar contratos vinculantes.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">4. Conta do Usuário</h3>
                <p>
                  Você é responsável por manter a confidencialidade de sua conta e senha. Qualquer atividade realizada 
                  em sua conta será de sua responsabilidade.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Autenticidade dos Produtos</h3>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                  <p className="text-amber-800 dark:text-amber-200">
                    <strong>Importante:</strong> O Kura preza pela autenticidade das peças. É expressamente proibida a venda 
                    de réplicas, falsificações ou produtos de origem duvidosa. Usuários que violarem esta regra terão suas 
                    contas suspensas permanentemente.
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Responsabilidades do Vendedor</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Fornecer descrições precisas e fotos reais dos produtos</li>
                  <li>Declarar corretamente o estado de conservação das peças</li>
                  <li>Responder às mensagens dos compradores em tempo hábil</li>
                  <li>Cumprir com os prazos de entrega acordados</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Responsabilidades do Comprador</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Verificar as informações do produto antes da compra</li>
                  <li>Realizar o pagamento conforme acordado</li>
                  <li>Comunicar qualquer problema com a compra através da plataforma</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">8. Transações e Pagamentos</h3>
                <p>
                  As transações são realizadas diretamente entre compradores e vendedores. O Kura não se responsabiliza 
                  por disputas financeiras entre as partes, mas oferece suporte para mediação quando necessário.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Privacy Policy */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Política de Privacidade
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground italic text-lg mb-6">
              Em revisão
            </p>

            <div className="space-y-6 text-muted-foreground">
              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">1. Coleta de Dados</h3>
                <p>
                  Coletamos informações necessárias para o funcionamento da plataforma, incluindo:
                </p>
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
                  <p>
                    Seus dados sensíveis (CPF, CNPJ, chave PIX) são criptografados utilizando padrões de segurança 
                    avançados (AES-256) e nunca são expostos ou compartilhados com terceiros não autorizados.
                  </p>
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
                <p>
                  Não vendemos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. 
                  Podemos compartilhar dados apenas quando:
                </p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Necessário para completar uma transação entre usuários</li>
                  <li>Exigido por lei ou ordem judicial</li>
                  <li>Para proteger os direitos e segurança da plataforma e seus usuários</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">5. Seus Direitos</h3>
                <p>De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir dados incompletos ou desatualizados</li>
                  <li>Solicitar a exclusão de seus dados</li>
                  <li>Revogar o consentimento a qualquer momento</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">6. Retenção de Dados</h3>
                <p>
                  Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para cumprir 
                  obrigações legais, resolver disputas e fazer cumprir nossos acordos.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold text-foreground mb-2">7. Contato</h3>
                <p>
                  Para questões sobre privacidade ou para exercer seus direitos, entre em contato conosco 
                  através do e-mail: <span className="text-primary font-medium">privacidade@kuralab.com.br</span>
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Última atualização: Janeiro de 2026</p>
        </div>
      </main>
    </div>
  );
}