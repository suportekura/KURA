import { ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type ModerationModalMode = 'block' | 'confirm';

interface ImageModerationModalProps {
  open: boolean;
  /** 'block' = só trocar (ex.: sexual de altíssima confiança); 'confirm' = trocar ou enviar mesmo assim. */
  mode: ModerationModalMode;
  /** Categoria dominante retornada pela moderação (ex.: "sexual", "violence"). */
  category?: string;
  /** Trocar foto: fecha o modal para a pessoa remover/trocar a imagem sinalizada. */
  onReplace: () => void;
  /** Enviar mesmo assim: segue para revisão humana (só no modo 'confirm'). */
  onSendAnyway?: () => void;
  onOpenChange?: (open: boolean) => void;
}

// Categoria técnica -> linguagem natural. Nunca expomos o score numérico.
function categoryLabel(category?: string): string {
  if (category === 'sexual') return 'conteúdo sexual';
  if (category === 'violence' || category === 'violence/graphic') return 'violência';
  if (category?.startsWith('self-harm')) return 'conteúdo de automutilação';
  return 'conteúdo sensível';
}

export function ImageModerationModal({
  open,
  mode,
  category,
  onReplace,
  onSendAnyway,
  onOpenChange,
}: ImageModerationModalProps) {
  const label = categoryLabel(category);
  const isBlock = mode === 'block';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Decisão obrigatória: não fecha no Esc nem clicando fora. */}
      <AlertDialogContent
        className="rounded-2xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-olive-warm">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">
            {isBlock ? 'Não foi possível publicar esta foto' : 'Revise sua foto'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center leading-relaxed">
            {isBlock
              ? `Detectamos possível ${label} nesta imagem, então ela não pode ser publicada. Troque a foto para continuar — sem problemas, acontece.`
              : `Esta imagem pode conter possível ${label} e talvez não seja aprovada. Você pode trocar a foto ou enviar mesmo assim — nesse caso ela passa por uma revisão da nossa equipe antes de ir ao ar.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={onReplace} className="h-12 w-full rounded-xl">
            Trocar foto
          </Button>
          {!isBlock && (
            <Button
              variant="outline"
              onClick={onSendAnyway}
              className="h-12 w-full rounded-xl"
            >
              Enviar mesmo assim
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
