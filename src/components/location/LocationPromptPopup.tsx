import { MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';

interface LocationPromptPopupProps {
  onRequestLocation: () => void;
}

/**
 * A non-blocking popup that appears when user tries to use 
 * proximity features without location enabled
 */
export function LocationPromptPopup({ onRequestLocation }: LocationPromptPopupProps) {
  const [dismissed, setDismissed] = useState(false);
  const { hasLocation } = useGeolocation();

  // Don't show if user has location or dismissed
  if (hasLocation || dismissed) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="card-elevated p-4 relative">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <div className="flex items-start gap-3 pr-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          
          <div className="space-y-2 flex-1">
            <h3 className="font-medium text-foreground text-sm">
              Explore o que há de melhor por perto
            </h3>
            <p className="text-xs text-muted-foreground">
              Com sua localização, encontramos peças mais perto de você.
            </p>
            
            <Button 
              size="sm"
              onClick={onRequestLocation}
              className="w-full mt-2"
            >
              Ativar localização
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}