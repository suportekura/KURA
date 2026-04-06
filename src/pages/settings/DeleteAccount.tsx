import { useState } from 'react';
import { ArrowLeft, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const canDelete = confirmText === 'EXCLUIR' && understood;

  const handleDelete = async () => {
    if (!user || !canDelete) return;

    setLoading(true);

    try {
      // Delete user data from all related tables (RLS policies allow this)
      await Promise.all([
        supabase.from('pf_profiles').delete().eq('user_id', user.id),
        supabase.from('pj_profiles').delete().eq('user_id', user.id),
        supabase.from('payment_profiles').delete().eq('user_id', user.id),
        supabase.from('addresses').delete().eq('user_id', user.id),
        supabase.from('favorites').delete().eq('user_id', user.id),
        supabase.from('user_locations').delete().eq('user_id', user.id),
        supabase.from('profiles').delete().eq('user_id', user.id),
      ]);

      // Sign out the user
      await signOut();

      toast({
        title: 'Conta excluída',
        description: 'Sua conta foi removida com sucesso.',
      });

      navigate('/auth');
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir conta',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setShowDialog(false);
    }
  };

  return (
    <AppLayout showHeader={false}>
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Excluir conta
          </h1>
        </div>

        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">Atenção</CardTitle>
                <CardDescription>Esta ação é irreversível</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Ao excluir sua conta:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Todos os seus dados pessoais serão removidos</li>
                <li>Seus anúncios serão desativados</li>
                <li>Você perderá acesso às suas conversas</li>
                <li>Não será possível recuperar a conta</li>
              </ul>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox 
                id="understood" 
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
              />
              <Label htmlFor="understood" className="text-sm font-normal cursor-pointer">
                Eu entendo que esta ação é permanente e não pode ser desfeita.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                Digite <span className="font-mono font-bold">EXCLUIR</span> para confirmar
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="EXCLUIR"
                className="font-mono"
              />
            </div>

            <Button 
              variant="destructive"
              onClick={() => setShowDialog(true)}
              className="w-full"
              disabled={!canDelete || loading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir minha conta
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
              <AlertDialogDescription>
                Sua conta e todos os dados associados serão permanentemente excluídos. 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Sim, excluir conta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
