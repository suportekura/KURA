import { MapPinOff, Settings, Keyboard } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ManualLocationDialog } from './ManualLocationDialog';

export function LocationBlockedDialog() {
  const { 
    showLocationBlockedDialog, 
    setShowLocationBlockedDialog 
  } = useGeolocation();
  
  const [showManualInput, setShowManualInput] = useState(false);

  const handleOpenSettings = () => {
    // This can't directly open browser settings, but we can guide the user
    // For mobile devices, this would be different
    alert('Por favor, acesse as configurações do seu navegador e permita a localização para este site.');
  };

  const handleManualInput = () => {
    setShowLocationBlockedDialog(false);
    setShowManualInput(true);
  };

  const handleClose = () => {
    setShowLocationBlockedDialog(false);
  };

  return (
    <>
      <Dialog open={showLocationBlockedDialog} onOpenChange={setShowLocationBlockedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <MapPinOff className="w-8 h-8 text-destructive" />
            </div>
            <DialogTitle className="text-xl font-display">
              Sua localização está desativada
            </DialogTitle>
            <DialogDescription className="text-base">
              Com ela, a Kura prioriza peças da sua região para a entrega ficar mais 
              barata e rápida. Quer ativar agora?
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={handleOpenSettings}
              className="w-full gap-2"
            >
              <Settings className="w-4 h-4" />
              Ativar nas Configurações
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleManualInput}
              className="w-full gap-2"
            >
              <Keyboard className="w-4 h-4" />
              Inserir CEP manualmente
            </Button>

            <Button 
              variant="ghost" 
              onClick={handleClose}
              className="w-full text-muted-foreground"
            >
              Continuar sem localização
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManualLocationDialog 
        open={showManualInput} 
        onOpenChange={setShowManualInput} 
      />
    </>
  );
}