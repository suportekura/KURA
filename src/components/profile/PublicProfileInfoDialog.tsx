import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Users, ShoppingBag, Star } from 'lucide-react';

interface PublicProfileInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

const STORAGE_KEY = 'kura_hide_public_profile_info';

export function PublicProfileInfoDialog({ 
  open, 
  onOpenChange,
  onContinue,
}: PublicProfileInfoDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onOpenChange(false);
    onContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Eye className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Seu Perfil Público
          </DialogTitle>
          <DialogDescription className="text-center">
            Essa é a página que outros usuários da KURA veem quando visitam seu perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Visibilidade</p>
                <p className="text-xs text-muted-foreground">
                  Compradores e vendedores podem ver seu perfil ao clicar no seu nome em anúncios ou conversas.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <ShoppingBag className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">O que aparece</p>
                <p className="text-xs text-muted-foreground">
                  Seus produtos à venda, descrição da loja, avaliações recebidas e quantidade de seguidores.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Star className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Sua reputação</p>
                <p className="text-xs text-muted-foreground">
                  Sua nota como vendedor e comprador ajudam a construir confiança com outros usuários.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Não exibir novamente
            </label>
          </div>
        </div>

        <Button onClick={handleContinue} className="w-full">
          Ver meu perfil público
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowPublicProfileInfo(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}
