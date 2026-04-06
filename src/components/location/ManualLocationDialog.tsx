import { useState } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';

interface ManualLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

// Round coordinates to 4 decimal places for privacy
function roundCoordinate(coord: number, decimals: number = 4): number {
  return Math.round(coord * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function ManualLocationDialog({ open, onOpenChange }: ManualLocationDialogProps) {
  const { toast } = useToast();
  const { setLocationFromCep } = useGeolocation();
  
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCep(formatCep(e.target.value));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      setError('CEP deve ter 8 dígitos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get address from ViaCEP
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const viaCepData: ViaCepResponse = await viaCepResponse.json();

      if (viaCepData.erro) {
        setError('CEP não encontrado');
        setLoading(false);
        return;
      }

      // 2. Get coordinates from address using Nominatim
      const searchQuery = `${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&accept-language=pt-BR`,
        { headers: { 'User-Agent': 'Kura App' } }
      );
      
      const nominatimData: NominatimResponse[] = await nominatimResponse.json();

      if (!nominatimData.length) {
        setError('Não foi possível obter as coordenadas para este CEP');
        setLoading(false);
        return;
      }

      const latitude = roundCoordinate(parseFloat(nominatimData[0].lat));
      const longitude = roundCoordinate(parseFloat(nominatimData[0].lon));

      // 3. Save location (works for both logged and non-logged users)
      const locationData = {
        latitude,
        longitude,
        accuracy: null, // Manual input has no accuracy
        city: viaCepData.localidade,
        state: viaCepData.uf,
        locationUpdatedAt: new Date().toISOString(),
      };

      const success = await setLocationFromCep(locationData);

      if (!success) {
        throw new Error('Erro ao salvar localização');
      }

      toast({
        title: 'Localização atualizada!',
        description: `${viaCepData.localidade}, ${viaCepData.uf}`,
      });
      
      onOpenChange(false);
      setCep('');
    } catch (err) {
      console.error('[ManualLocationDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar CEP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-display">
            Inserir localização manualmente
          </DialogTitle>
          <DialogDescription className="text-base">
            Digite seu CEP para definirmos sua região aproximada.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              type="text"
              placeholder="00000-000"
              value={cep}
              onChange={handleCepChange}
              maxLength={9}
              className="text-center text-lg tracking-widest"
            />
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </div>
          
          <Button 
            type="submit"
            disabled={loading || cep.replace(/\D/g, '').length !== 8}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Buscar localização
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}