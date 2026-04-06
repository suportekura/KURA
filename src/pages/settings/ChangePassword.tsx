import { useState } from 'react';
import { ArrowLeft, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resetPasswordSchema } from '@/lib/validations';

type Step = 'request' | 'verify' | 'success';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRequestCode = async () => {
    if (!user?.email) {
      toast({
        title: 'Erro',
        description: 'Não foi possível identificar seu e-mail.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('send-verification-code', {
        body: { 
          email: user.email, 
          type: 'password_reset' 
        },
      });

      if (error) throw error;

      toast({
        title: 'Código enviado!',
        description: 'Verifique seu e-mail para o código de verificação.',
      });

      setStep('verify');
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar código',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;

    if (verificationCode.length !== 6) {
      toast({
        title: 'Código inválido',
        description: 'O código deve ter 6 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    const validation = resetPasswordSchema.safeParse({ 
      password: newPassword, 
      confirmPassword 
    });
    
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { 
          email: user.email, 
          code: verificationCode,
          newPassword 
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setStep('success');
      
      toast({
        title: 'Senha alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Código inválido ou expirado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <AppLayout showHeader={false}>
        <div className="px-4 py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Alterar senha
            </h1>
          </div>

          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
              <h3 className="text-xl font-semibold mb-2">Senha alterada!</h3>
              <p className="text-muted-foreground mb-6">
                Sua senha foi atualizada com sucesso.
              </p>
              <Button onClick={() => navigate('/settings')}>
                Voltar às configurações
              </Button>
            </CardContent>
          </Card>
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
            Alterar senha
          </h1>
        </div>

        {step === 'request' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Confirme sua identidade</CardTitle>
              <CardDescription>
                Enviaremos um código para {user?.email} para confirmar a alteração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleRequestCode} 
                className="w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enviar código de verificação
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'verify' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Redefinir senha</CardTitle>
              <CardDescription>
                Digite o código enviado para seu e-mail e sua nova senha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Código de verificação</Label>
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
                >
                  <InputOTPGroup className="w-full justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="w-10 h-12" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite sua nova senha"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, com letras e números.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                />
              </div>

              <Button 
                onClick={handleResetPassword} 
                className="w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Alterar senha
              </Button>

              <Button 
                variant="ghost" 
                className="w-full"
                onClick={handleRequestCode}
                disabled={loading}
              >
                Reenviar código
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
