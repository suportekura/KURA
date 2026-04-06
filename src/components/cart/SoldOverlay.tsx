import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface SoldOverlayProps {
  onRemove: () => void;
}

export function SoldOverlay({ onRemove }: SoldOverlayProps) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2 z-10">
      {/* Sold Watermark */}
      <div className="bg-destructive/90 text-destructive-foreground px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg transform -rotate-12">
        Vendido
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRemove}
          className="text-xs"
        >
          Remover
        </Button>
        <Button
          asChild
          size="sm"
          className="text-xs"
        >
          <Link to="/">
            <Home className="w-3 h-3 mr-1" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
}
