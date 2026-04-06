import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';

export function PushPermissionPrompt() {
  const { user } = useAuth();
  const { permission, isSubscribed, isLoading, subscribe, isSupported } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!user || !isSupported || isSubscribed || permission === 'denied') {
      setDismissed(true);
      return;
    }

    // Check if user has previously dismissed
    const wasDismissed = localStorage.getItem('push-prompt-dismissed');
    if (wasDismissed) {
      const dismissedAt = parseInt(wasDismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    // Delay showing the prompt
    const timer = setTimeout(() => setDismissed(false), 3000);
    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, permission]);

  if (dismissed || !user || !isSupported || isSubscribed || permission === 'denied') {
    return null;
  }

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push-prompt-dismissed', Date.now().toString());
  };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Ativar notificações
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receba alertas de mensagens, ofertas e atualizações de pedidos.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleEnable}
                disabled={isLoading}
              >
                {isLoading ? 'Ativando...' : 'Ativar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleDismiss}
              >
                Agora não
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
