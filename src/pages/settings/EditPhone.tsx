import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

export default function EditPhone() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();
  
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile?.phone) {
      setPhone(formatPhone(profile.phone));
    }
  }, [profile]);

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleSave = async () => {
    if (!user) return;

    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length > 0 && cleanPhone.length < 10) {
      toast({
        title: 'Número inválido',
        description: 'Digite um número de celular válido.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: cleanPhone || null })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Celular atualizado',
        description: 'Seu número foi salvo com sucesso.',
      });

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
            Celular
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Número de telefone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Usado para contato sobre compras e vendas.
              </p>
            </div>

            <Button 
              onClick={handleSave} 
              className="w-full mt-4"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
