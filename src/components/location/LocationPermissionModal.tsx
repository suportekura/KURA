import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGeolocation } from '@/hooks/useGeolocation';

export function LocationPermissionModal() {
  const { 
    showLocationPrompt, 
    setShowLocationPrompt, 
    requestLocation, 
    loading 
  } = useGeolocation();

  const handleAllowLocation = async () => {
    await requestLocation();
  };

  const handleSkip = () => {
    setShowLocationPrompt(false);
  };

  return (
    <Dialog open={showLocationPrompt} onOpenChange={setShowLocationPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-display">
            Tornar sua experiência local
          </DialogTitle>
          <DialogDescription className="text-base">
            Usamos sua localização para mostrar peças disponíveis perto de você, 
            facilitando entregas mais rápidas e baratas.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleAllowLocation} 
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Obtendo localização...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Permitir localização
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            disabled={loading}
            className="w-full text-muted-foreground"
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}