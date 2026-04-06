import { ArrowLeft, Mail, MessageCircle, FileText, ExternalLink } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Support() {
  const navigate = useNavigate();

  return (
    <AppLayout showHeader={false}>
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Suporte
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Como podemos ajudar?</CardTitle>
            <CardDescription>
              Escolha uma das opções abaixo para entrar em contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <a
              href="mailto:suporte@kuralab.com.br"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">E-mail</p>
                <p className="text-sm text-muted-foreground">suporte@kuralab.com.br</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>

            <div className="flex items-center gap-4 p-4 rounded-lg border border-border opacity-60">
              <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Chat</p>
                <p className="text-sm text-muted-foreground">Em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              to="/terms"
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Termos de Uso</p>
                <p className="text-sm text-muted-foreground">Leia nossos termos</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
