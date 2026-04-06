import { useState } from 'react';
import { MapPin, Navigation, Keyboard, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ManualLocationDialog } from './ManualLocationDialog';

interface LocationUpdateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationUpdateSheet({ open, onOpenChange }: LocationUpdateSheetProps) {
  const { location, requestLocation, loading } = useGeolocation();
  const [showManualInput, setShowManualInput] = useState(false);

  const handleUpdateLocation = async () => {
    const success = await requestLocation();
    if (success) {
      onOpenChange(false);
    }
  };

  const handleManualInput = () => {
    onOpenChange(false);
    setShowManualInput(true);
  };

  const locationDisplay = location 
    ? `${location.city || 'Cidade desconhecida'}${location.state ? `, ${location.state}` : ''}`
    : 'Não definida';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <SheetTitle className="font-display text-lg">
              Sua localização
            </SheetTitle>
            <SheetDescription>
              {location ? (
                <span className="flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {locationDisplay}
                </span>
              ) : (
                'Localização não definida'
              )}
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col gap-3 pt-2 pb-6">
            <Button 
              onClick={handleUpdateLocation}
              disabled={loading}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  {location ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                  {location ? 'Atualizar localização' : 'Usar localização atual'}
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleManualInput}
              disabled={loading}
              className="w-full gap-2"
            >
              <Keyboard className="w-4 h-4" />
              Inserir CEP manualmente
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ManualLocationDialog 
        open={showManualInput} 
        onOpenChange={setShowManualInput} 
      />
    </>
  );
}