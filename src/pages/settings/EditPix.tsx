import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

const pixKeyLabels: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Celular',
  random: 'Chave aleatória',
};

export default function EditPix() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();
  
  const [loading, setLoading] = useState(false);
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('email');
  const [pixKey, setPixKey] = useState('');

  useEffect(() => {
    if (profile?.paymentProfile) {
      setPixKeyType(profile.paymentProfile.pix_key_type as PixKeyType);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    if (!pixKey.trim()) {
      toast({
        title: 'Chave obrigatória',
        description: 'Digite sua chave PIX.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call edge function to update PIX (it handles encryption)
      const { error } = await supabase.functions.invoke('save-user-profile', {
        body: {
          user_type: profile?.userType,
          pix_key: pixKey,
          pix_key_type: pixKeyType,
          update_pix_only: true,
        },
      });

      if (error) throw error;

      toast({
        title: 'Chave PIX atualizada',
        description: 'Sua chave foi salva com segurança.',
      });

      setPixKey('');
      refetch();
      navigate('/settings');
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Chave PIX
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Seus dados são criptografados e nunca são expostos.
              </p>
            </div>

            {profile?.paymentProfile && (
              <div className="p-3 bg-olive-warm/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Tipo de chave atual: <span className="font-medium text-foreground">{pixKeyLabels[profile.paymentProfile.pix_key_type as PixKeyType]}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pixKeyType">Tipo da chave</Label>
              <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixKeyType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Celular</SelectItem>
                  <SelectItem value="random">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixKey">Nova chave PIX</Label>
              <Input
                id="pixKey"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={`Digite sua chave ${pixKeyLabels[pixKeyType]}`}
              />
            </div>

            <Button 
              onClick={handleSave} 
              className="w-full mt-4"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Atualizar chave PIX
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
