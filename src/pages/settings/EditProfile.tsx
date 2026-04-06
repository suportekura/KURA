import { useState, useEffect, useRef } from 'react';
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
import { cn } from '@/lib/utils';
import { isValidUsernameFormat } from '@/lib/usernameValidation';

function getDaysUntilUsernameEditable(updatedAt: string | null): number | null {
  if (!updatedAt) return null; // never changed → free to edit
  const cooldownEnd = new Date(updatedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const remaining = cooldownEnd - Date.now();
  if (remaining <= 0) return null; // cooldown over → free to edit
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();

  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [username, setUsername] = useState('');
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState<string | null>(null);
  const [usernameCheckState, setUsernameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameFormatError, setUsernameFormatError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.userType === 'PF' && profile.pfProfile) {
        setDisplayName(profile.pfProfile.display_name || '');
        setFullName(profile.pfProfile.full_name || '');
      } else if (profile.userType === 'PJ' && profile.pjProfile) {
        setDisplayName(profile.pjProfile.display_name || '');
        setCompanyName(profile.pjProfile.company_name || '');
      }
    }

    if (user) {
      (async () => {
        const { data: profileRow } = await (supabase
          .from('profiles')
          .select('username, username_updated_at')
          .eq('user_id', user.id)
          .single() as any);

        if (profileRow) {
          setUsername(profileRow.username || '');
          setUsernameUpdatedAt(profileRow.username_updated_at);
        }
      })();
    }
  }, [profile, user]);

  const handleUsernameChange = (raw: string) => {
    setUsername(raw);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    const { valid, error } = isValidUsernameFormat(raw);
    if (!valid) {
      setUsernameFormatError(error || null);
      setUsernameCheckState('invalid');
      return;
    }
    setUsernameFormatError(null);
    setUsernameCheckState('idle');
    usernameDebounceRef.current = setTimeout(async () => {
      setUsernameCheckState('checking');
      const { data } = await supabase
        .from('public_profiles')
        .select('user_id')
        .ilike('username', raw)
        .neq('user_id', user!.id)
        .maybeSingle();
      setUsernameCheckState(data === null ? 'available' : 'taken');
    }, 500);
  };

  const handleSaveUsername = async () => {
    if (!user || usernameCheckState !== 'available') return;
    setSavingUsername(true);

    const { error } = await (supabase
      .from('profiles')
      .update({
        username,
        username_updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', user.id) as any);

    setSavingUsername(false);

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Este @username foi escolhido por outra pessoa agora mesmo. Tente outro.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao salvar.', variant: 'destructive' });
      }
      return;
    }

    setUsernameUpdatedAt(new Date().toISOString());
    toast({ title: '@username atualizado com sucesso.' });
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setLoading(true);

    try {
      if (profile.userType === 'PF') {
        const { error } = await supabase
          .from('pf_profiles')
          .update({
            display_name: displayName,
            full_name: fullName,
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else if (profile.userType === 'PJ') {
        const { error } = await supabase
          .from('pj_profiles')
          .update({
            display_name: displayName,
            company_name: companyName,
          })
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // Also update the main profiles table
      await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', user.id);

      toast({
        title: 'Dados atualizados',
        description: 'Suas informações foram salvas com sucesso.',
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
            Dados pessoais
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {profile?.userType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.userType === 'PF' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Apelido (nome público)</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como deseja ser chamado"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este é o nome que outros usuários verão.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Razão social</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome fantasia (público)</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nome público da loja"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este é o nome que aparecerá nos seus anúncios.
                  </p>
                </div>
              </>
            )}

            {/* @username section */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label>@username</Label>
              {(() => {
                const daysLeft = getDaysUntilUsernameEditable(usernameUpdatedAt);
                if (daysLeft !== null) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                        <span className="text-destructive text-sm font-semibold">🔒</span>
                        <div>
                          <p className="text-sm font-medium text-destructive">Alteração bloqueada</p>
                          <p className="text-xs text-muted-foreground">Próxima troca disponível em {daysLeft} dias</p>
                        </div>
                      </div>
                      <div className="relative opacity-50">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">@</span>
                        <Input value={username} disabled className="pl-7" />
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
                      <Input
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="seu.username"
                        className={cn(
                          'pl-7',
                          usernameCheckState === 'available' && 'border-green-500',
                          usernameCheckState === 'taken' && 'border-destructive',
                          usernameCheckState === 'invalid' && 'border-amber-500',
                        )}
                      />
                    </div>
                    {usernameCheckState === 'checking' && <p className="text-xs text-muted-foreground">⏳ Verificando...</p>}
                    {usernameCheckState === 'available' && <p className="text-xs text-green-600">✓ Disponível</p>}
                    {usernameCheckState === 'taken' && <p className="text-xs text-destructive">✗ Já está em uso</p>}
                    {usernameCheckState === 'invalid' && <p className="text-xs text-amber-600">{usernameFormatError}</p>}
                    <p className="text-xs text-muted-foreground">⚠ Após alterar, você só poderá trocar novamente em 30 dias.</p>
                    <Button
                      onClick={handleSaveUsername}
                      disabled={usernameCheckState !== 'available' || savingUsername}
                      className="w-full"
                    >
                      {savingUsername && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Salvar @username
                    </Button>
                  </div>
                );
              })()}
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
