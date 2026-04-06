import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Instagram, Globe, ImageIcon, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ImageCropper } from '@/components/ui/image-cropper';

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean } | any;
}

interface ShopAddress {
  [key: string]: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const DAYS = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: '09:00', close: '18:00', closed: false },
  tuesday: { open: '09:00', close: '18:00', closed: false },
  wednesday: { open: '09:00', close: '18:00', closed: false },
  thursday: { open: '09:00', close: '18:00', closed: false },
  friday: { open: '09:00', close: '18:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

// Aspect ratios
const BANNER_ASPECT = 4 / 1; // 1200x300 = 4:1
const LOGO_ASPECT = 1; // Square

export default function EditShop() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hideBusinessHours, setHideBusinessHours] = useState(false);
  const [showBusinessHoursFields, setShowBusinessHoursFields] = useState(false);
  const [hasPhysicalStore, setHasPhysicalStore] = useState(false);
  const [showCouponsOnProfile, setShowCouponsOnProfile] = useState(true);
  const [shopAddress, setShopAddress] = useState<ShopAddress>({
    zip_code: '', street: '', number: '', complement: '',
    neighborhood: '', city: '', state: '',
  });
  const [fetchingCep, setFetchingCep] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'banner' | 'logo'>('banner');

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('shop_description, business_hours, social_instagram, social_website, banner_url, shop_logo_url')
        .eq('user_id', user.id)
        .single();

if (!error && data) {
        setDescription(data.shop_description || '');
        const hours = (data.business_hours as any) || DEFAULT_HOURS;
        // Extract hidden flag if present
        if (hours._hidden !== undefined) {
          setHideBusinessHours(hours._hidden === true);
        }
        // Extract physical store address
        if (hours._has_physical_store !== undefined) {
          setHasPhysicalStore(hours._has_physical_store === true);
        }
        if (hours._show_business_hours !== undefined) {
          setShowBusinessHoursFields(hours._show_business_hours === true);
        }
        if (hours._show_coupons !== undefined) {
          setShowCouponsOnProfile(hours._show_coupons === true);
        }
        if (hours._shop_address) {
          setShopAddress(hours._shop_address);
        }
        // Clean meta keys before setting business hours
        const cleanHours = { ...hours };
        delete cleanHours._hidden;
        delete cleanHours._has_physical_store;
        delete cleanHours._shop_address;
        delete cleanHours._show_business_hours;
        delete cleanHours._show_coupons;
        setBusinessHours(cleanHours as BusinessHours);
        setInstagram(data.social_instagram || '');
        setWebsite(data.social_website || '');
        setBannerUrl(data.banner_url || null);
        setLogoUrl(data.shop_logo_url || null);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleBannerSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Use JPEG, PNG ou WEBP.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 10MB.',
        variant: 'destructive',
      });
      return;
    }

    // Open cropper instead of uploading directly
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImage(reader.result as string);
      setCropperType('banner');
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  };

  const uploadBanner = async (blob: Blob) => {
    if (!user) return;

    setUploadingBanner(true);

    try {
      const fileName = `${user.id}/banner.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: urlWithCacheBust })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setBannerUrl(urlWithCacheBust);

      toast({
        title: 'Banner atualizado',
        description: 'O banner da sua loja foi alterado.',
      });
    } catch (error: any) {
      console.error('Error uploading banner:', error);
      toast({
        title: 'Erro ao enviar banner',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveBanner = async () => {
    if (!user) return;

    setUploadingBanner(true);

    try {
      await supabase.storage.from('avatars').remove([
        `${user.id}/banner.jpg`,
        `${user.id}/banner.png`,
        `${user.id}/banner.webp`,
      ]);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setBannerUrl(null);

      toast({
        title: 'Banner removido',
        description: 'O banner da sua loja foi removido.',
      });
    } catch (error: any) {
      console.error('Error removing banner:', error);
      toast({
        title: 'Erro ao remover banner',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Use JPEG, PNG ou WEBP.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
        variant: 'destructive',
      });
      return;
    }

    // Open cropper instead of uploading directly
    const reader = new FileReader();
    reader.onload = () => {
      setCropperImage(reader.result as string);
      setCropperType('logo');
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const uploadLogo = async (blob: Blob) => {
    if (!user) return;

    setUploadingLogo(true);

    try {
      const fileName = `${user.id}/shop-logo.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ shop_logo_url: urlWithCacheBust })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setLogoUrl(urlWithCacheBust);

      toast({
        title: 'Logo atualizado',
        description: 'O logo da sua loja foi alterado.',
      });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCropComplete = (blob: Blob) => {
    if (cropperType === 'banner') {
      uploadBanner(blob);
    } else {
      uploadLogo(blob);
    }
    setCropperImage(null);
  };

  const handleRemoveLogo = async () => {
    if (!user) return;

    setUploadingLogo(true);

    try {
      await supabase.storage.from('avatars').remove([
        `${user.id}/shop-logo.jpg`,
        `${user.id}/shop-logo.png`,
        `${user.id}/shop-logo.webp`,
      ]);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ shop_logo_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setLogoUrl(null);

      toast({
        title: 'Logo removido',
        description: 'O logo da sua loja foi removido.',
      });
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast({
        title: 'Erro ao remover logo',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return digits;
  };

  const fetchAddressByCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setShopAddress(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      } else {
        toast({ title: 'CEP não encontrado', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao buscar CEP', variant: 'destructive' });
    } finally {
      setFetchingCep(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate address if physical store is active
    if (hasPhysicalStore) {
      if (!shopAddress.zip_code || !shopAddress.street || !shopAddress.number || !shopAddress.neighborhood || !shopAddress.city || !shopAddress.state) {
        toast({ title: 'Preencha todos os campos obrigatórios do endereço', variant: 'destructive' });
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    try {
      // Include meta flags in business_hours
      const hoursToSave = {
        ...businessHours,
        _hidden: !showBusinessHoursFields,
        _has_physical_store: hasPhysicalStore,
        _shop_address: hasPhysicalStore ? shopAddress : null,
        _show_business_hours: showBusinessHoursFields,
        _show_coupons: showCouponsOnProfile,
      };
      
      const { error } = await supabase
        .from('profiles')
        .update({
          shop_description: description || null,
          business_hours: hoursToSave,
          social_instagram: instagram || null,
          social_website: website || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Loja atualizada',
        description: 'As informações da sua loja foram salvas.',
      });
      navigate(-1);
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Editar Loja</h1>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Banner */}
        <div className="space-y-2">
          <Label>Banner da Loja</Label>
          <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg overflow-hidden">
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background h-8 w-8"
                  disabled={uploadingBanner}
                >
                  {uploadingBanner ? (
                    <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => bannerInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {bannerUrl ? 'Alterar banner' : 'Adicionar banner'}
                </DropdownMenuItem>
                {bannerUrl && (
                  <DropdownMenuItem 
                    onClick={handleRemoveBanner}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover banner
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleBannerSelect}
              className="hidden"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Recomendado: 1200x300 pixels. Máximo 10MB.
          </p>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo da Loja</Label>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full overflow-hidden flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-2" />
                    )}
                    {logoUrl ? 'Alterar logo' : 'Adicionar logo'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => logoInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    {logoUrl ? 'Alterar logo' : 'Adicionar logo'}
                  </DropdownMenuItem>
                  {logoUrl && (
                    <DropdownMenuItem 
                      onClick={handleRemoveLogo}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover logo
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <p className="text-xs text-muted-foreground">
                Quadrada, 400x400px. Máximo 5MB.
              </p>
            </div>
            
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição da Loja</Label>
          <Textarea
            id="description"
            placeholder="Conte sobre sua loja, o que você vende, diferenciais..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {description.length}/500
          </p>
        </div>

        {/* Social Links */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground">Redes Sociais</h2>
          
          <div className="space-y-2">
            <Label htmlFor="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </Label>
            <Input
              id="instagram"
              placeholder="@seuinstagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Website
            </Label>
            <Input
              id="website"
              placeholder="https://seusite.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Loja física</span>
              <Switch checked={hasPhysicalStore} onCheckedChange={setHasPhysicalStore} />
            </div>
          </div>

          {hasPhysicalStore && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={shopAddress.zip_code}
                    onChange={(e) => {
                      const formatted = formatCep(e.target.value);
                      setShopAddress(prev => ({ ...prev, zip_code: formatted }));
                      if (formatted.replace(/\D/g, '').length === 8) {
                        fetchAddressByCep(formatted);
                      }
                    }}
                    maxLength={9}
                    inputMode="numeric"
                  />
                  {fetchingCep && (
                    <div className="flex items-center">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">Rua / Logradouro</Label>
                <Input
                  id="street"
                  placeholder="Rua, Avenida..."
                  value={shopAddress.street}
                  onChange={(e) => setShopAddress(prev => ({ ...prev, street: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="addr-number">Número *</Label>
                  <Input
                    id="addr-number"
                    placeholder="123"
                    value={shopAddress.number}
                    onChange={(e) => setShopAddress(prev => ({ ...prev, number: e.target.value }))}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    placeholder="Sala 2, Loja B..."
                    value={shopAddress.complement}
                    onChange={(e) => setShopAddress(prev => ({ ...prev, complement: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  placeholder="Bairro"
                  value={shopAddress.neighborhood}
                  onChange={(e) => setShopAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="addr-city">Cidade</Label>
                  <Input
                    id="addr-city"
                    value={shopAddress.city}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addr-state">Estado</Label>
                  <Input
                    id="addr-state"
                    value={shopAddress.state}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coupons Visibility */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Cupons no Perfil</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exibir cupons ativos na sua página pública
              </p>
            </div>
            <Switch
              checked={showCouponsOnProfile}
              onCheckedChange={setShowCouponsOnProfile}
            />
          </div>
        </div>

        {/* Business Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Horário de Funcionamento</h2>
            </div>
            <Switch
              checked={showBusinessHoursFields}
              onCheckedChange={setShowBusinessHoursFields}
            />
          </div>

          {showBusinessHoursFields && (
            <>
              <div className={`space-y-2 transition-opacity`}>
                {DAYS.map(({ key, label }) => {
                  const isClosed = businessHours[key]?.closed || false;
                  
                  return (
                    <div 
                      key={key} 
                      className={`rounded-lg border p-3 transition-colors ${
                        isClosed ? 'bg-muted/30 border-muted' : 'bg-background border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium min-w-[60px]">{label}</span>
                        
                        <div className="flex items-center gap-3 flex-1 justify-end">
                          {!isClosed && (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="time"
                                value={businessHours[key]?.open || '09:00'}
                                onChange={(e) => updateHours(key, 'open', e.target.value)}
                                className="w-[90px] h-8 text-xs px-2"
                              />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input
                                type="time"
                                value={businessHours[key]?.close || '18:00'}
                                onChange={(e) => updateHours(key, 'close', e.target.value)}
                                className="w-[90px] h-8 text-xs px-2"
                              />
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => updateHours(key, 'closed', !isClosed)}
                            className={`text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                              isClosed 
                                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' 
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            {isClosed ? 'Fechado' : 'Aberto'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Cropper Modal */}
      {cropperImage && (
        <ImageCropper
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setCropperImage(null);
          }}
          imageSrc={cropperImage}
          aspectRatio={cropperType === 'banner' ? BANNER_ASPECT : LOGO_ASPECT}
          onCropComplete={handleCropComplete}
          title={cropperType === 'banner' ? 'Ajustar banner' : 'Ajustar logo'}
        />
      )}
    </div>
  );
}
