import { useEffect, useState } from 'react';
import { Apple, Download, Monitor, Share, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useDetectPlatform } from '@/hooks/useDetectPlatform';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const iosSteps = [
  <>
    Toque no ícone de compartilhar <Share className="w-4 h-4 inline text-primary" /> na barra do
    navegador
  </>,
  <>Role para baixo e toque em "Adicionar à Tela de Início"</>,
  <>Toque em "Adicionar"</>,
];

export function InstallPromptModal() {
  const { user, profileStatus } = useAuth();
  const { platform, isStandalone } = useDetectPlatform();
  const { canInstall, isDismissed, markDismissed, triggerInstall } = usePWAInstall();
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  // "Login confirmado" no Kura = autenticado, email verificado e perfil completo
  // (evita sobrepor as etapas de verificação/profile-setup)
  const isAuthenticated =
    !!user && !!profileStatus?.emailVerified && !!profileStatus?.profileCompleted;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isStandalone) return; // já instalado
    if (isDismissed) return; // usuário dispensou antes
    if (platform === 'unsupported') return;
    if (platform !== 'ios' && !canInstall) return; // aguarda o beforeinstallprompt

    // Pequeno delay para não sobrepor o carregamento inicial
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isStandalone, isDismissed, platform, canInstall]);

  const handleDismiss = () => {
    markDismissed();
    setOpen(false);
  };

  const handleInstall = async () => {
    setInstalling(true);
    await triggerInstall();
    setInstalling(false);
    // Aceito ou recusado no prompt nativo, não insistir de novo
    markDismissed();
    setOpen(false);
  };

  const isMobile = platform === 'ios' || platform === 'android';

  const platformIndicator =
    platform === 'ios' ? (
      <>
        <Apple className="w-3.5 h-3.5" /> iOS
      </>
    ) : platform === 'android' ? (
      <>
        <Smartphone className="w-3.5 h-3.5" /> Android
      </>
    ) : (
      <>
        <Monitor className="w-3.5 h-3.5" /> Chrome/Edge
      </>
    );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center space-y-3">
          <div className="w-20 h-20 rounded-2xl bg-card shadow-card flex items-center justify-center">
            <img src="/pwa-192x192.png" alt="Kura" className="w-16 h-16 rounded-xl" />
          </div>
          <div className="badge-status bg-olive-warm text-muted-foreground gap-1.5">
            {platformIndicator}
          </div>
          <DialogTitle className="font-display text-lg font-semibold">
            {isMobile ? 'Instale o app no seu celular' : 'Instale o app no seu computador'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Acesse sem abrir o navegador, igual a um app nativo
          </DialogDescription>
        </DialogHeader>

        {platform === 'ios' ? (
          <>
            <ol className="space-y-3 text-sm text-muted-foreground">
              {iosSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button className="btn-primary w-full h-12" onClick={handleDismiss}>
              Entendi
            </button>
          </>
        ) : (
          <button className="btn-primary w-full h-12" onClick={handleInstall} disabled={installing}>
            <Download className="w-5 h-5 mr-2 inline" />
            Instalar app
          </button>
        )}

        <Button variant="ghost" className="w-full h-11 rounded-xl" onClick={handleDismiss}>
          Agora não
        </Button>
      </DialogContent>
    </Dialog>
  );
}
