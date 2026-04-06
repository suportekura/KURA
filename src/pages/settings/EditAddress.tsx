import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function EditAddress() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useUserProfile();

  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [formData, setFormData] = useState({
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (profile?.address) {
      setFormData({
        zip_code: profile.address.zip_code || '',
        street: profile.address.street || '',
        number: profile.address.number || '',
        complement: profile.address.complement || '',
        neighborhood: profile.address.neighborhood || '',
        city: profile.address.city || '',
        state: profile.address.state || '',
      });
    }
  }, [profile]);

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
  };

  const searchCep = async () => {
    const cep = formData.zip_code.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast({
        title: 'CEP inválido',
        description: 'Digite um CEP com 8 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'Verifique o CEP digitado.',
          variant: 'destructive',
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      }));

      toast({
        title: 'Endereço encontrado',
        description: 'Complete com o número e complemento.',
      });
    } catch (error) {
      console.error('[EditAddress] Error searching CEP:', error);
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSearchingCep(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate required fields
    if (!formData.zip_code || !formData.street || !formData.number || 
        !formData.neighborhood || !formData.city || !formData.state) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Check if user already has a primary address
      const { data: existingAddress, error: checkError } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (checkError) throw checkError;

      const addressData = {
        user_id: user.id,
        street: formData.street.trim(),
        number: formData.number.trim(),
        complement: formData.complement.trim() || null,
        neighborhood: formData.neighborhood.trim(),
        city: formData.city.trim(),
        state: formData.state.trim().toUpperCase(),
        zip_code: formData.zip_code.replace(/\D/g, ''),
        is_primary: true,
      };

      if (existingAddress) {
        // Update existing address
        const { error: updateError } = await supabase
          .from('addresses')
          .update(addressData)
          .eq('id', existingAddress.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new address
        const { error: insertError } = await supabase
          .from('addresses')
          .insert(addressData);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Endereço salvo',
        description: 'Seu endereço foi atualizado com sucesso.',
      });

      refetch();
      navigate('/settings');
    } catch (error) {
      console.error('[EditAddress] Error saving address:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl font-semibold">Endereço</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* CEP */}
        <div className="space-y-2">
          <Label htmlFor="zip_code">
            CEP <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="zip_code"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: formatCep(e.target.value) })}
              placeholder="00000-000"
              maxLength={9}
              className="input-premium"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={searchCep}
              disabled={searchingCep}
            >
              {searchingCep ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Street */}
        <div className="space-y-2">
          <Label htmlFor="street">
            Rua <span className="text-destructive">*</span>
          </Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            placeholder="Nome da rua"
            className="input-premium"
          />
        </div>

        {/* Number and Complement */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="number">
              Número <span className="text-destructive">*</span>
            </Label>
            <Input
              id="number"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              placeholder="123"
              className="input-premium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              value={formData.complement}
              onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
              placeholder="Apto, Bloco..."
              className="input-premium"
            />
          </div>
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label htmlFor="neighborhood">
            Bairro <span className="text-destructive">*</span>
          </Label>
          <Input
            id="neighborhood"
            value={formData.neighborhood}
            onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            placeholder="Nome do bairro"
            className="input-premium"
          />
        </div>

        {/* City and State */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="city">
              Cidade <span className="text-destructive">*</span>
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Nome da cidade"
              className="input-premium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">
              UF <span className="text-destructive">*</span>
            </Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
              placeholder="SP"
              maxLength={2}
              className="input-premium"
            />
          </div>
        </div>

        {/* Current Address Preview */}
        {profile?.address && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Endereço atual</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile.address.street}, {profile.address.number}
                  {profile.address.complement && ` - ${profile.address.complement}`}
                  <br />
                  {profile.address.neighborhood} - {profile.address.city}/{profile.address.state}
                  <br />
                  CEP: {profile.address.zip_code}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          className="w-full btn-primary h-12"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar endereço'
          )}
        </Button>
      </div>
    </div>
  );
}
