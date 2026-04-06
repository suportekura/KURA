import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, Building2, User, MapPin, Wallet, ChevronDown, ChevronUp, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  cleanDocument,
  formatDateBR,
  validateBirthDate,
} from '@/lib/documentValidation';

type UserType = 'PF' | 'PJ';
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
type Step = 'type' | 'personal' | 'address' | 'payment';

interface AddressData {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface ProfileSetupFormProps {
  onComplete: () => void;
  onBack: () => void;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function ProfileSetupForm({ onComplete, onBack }: ProfileSetupFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('type');
  
  // User type
  const [userType, setUserType] = useState<UserType | null>(null);
  
  // PF fields
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  // PJ fields
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  
  // Address
  const [address, setAddress] = useState<AddressData>({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
  });
  
  // Payment
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('email');
  
  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [pixKey, setPixKey] = useState('');

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    if (cleanDocument(formatted).length <= 11) {
      setCpf(formatted);
    }
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    if (cleanDocument(formatted).length <= 14) {
      setCnpj(formatted);
    }
  };

  const handleCEPChange = (value: string) => {
    const formatted = formatCEP(value);
    if (cleanDocument(formatted).length <= 8) {
      setAddress(prev => ({ ...prev, zip_code: formatted }));
    }
  };

  const fetchAddressByCEP = async (cep: string) => {
    const cleanedCep = cleanDocument(cep);
    if (cleanedCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(prev => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (error) {
        console.error('Error fetching CEP:', error);
      }
    }
  };

  const validateStep = (currentStep: Step): boolean => {
    switch (currentStep) {
      case 'type':
        if (!userType) {
          toast({ title: 'Selecione o tipo de conta', variant: 'destructive' });
          return false;
        }
        return true;
        
      case 'personal':
        if (userType === 'PF') {
          if (!fullName.trim() || fullName.length < 2) {
            toast({ title: 'Nome completo é obrigatório', variant: 'destructive' });
            return false;
          }
          if (!displayName.trim()) {
            toast({ title: 'Nome de exibição é obrigatório', variant: 'destructive' });
            return false;
          }
          if (!validateCPF(cpf)) {
            toast({ title: 'CPF inválido', description: 'Verifique os números digitados.', variant: 'destructive' });
            return false;
          }
          const bdResult = validateBirthDate(birthDate);
          if (!bdResult.valid) {
            toast({ title: 'Data de nascimento inválida', description: bdResult.error, variant: 'destructive' });
            return false;
          }
        } else {
          if (!companyName.trim()) {
            toast({ title: 'Razão social é obrigatória', variant: 'destructive' });
            return false;
          }
          if (!displayName.trim()) {
            toast({ title: 'Nome fantasia é obrigatório', variant: 'destructive' });
            return false;
          }
          if (!validateCNPJ(cnpj)) {
            toast({ title: 'CNPJ inválido', description: 'Verifique os números digitados.', variant: 'destructive' });
            return false;
          }
        }
        return true;
        
      case 'address':
        if (!address.street.trim() || !address.number.trim() || 
            !address.neighborhood.trim() || !address.city.trim() || 
            !address.state || cleanDocument(address.zip_code).length !== 8) {
          toast({ title: 'Preencha todos os campos obrigatórios do endereço', variant: 'destructive' });
          return false;
        }
        return true;
        
      case 'payment':
        if (!pixKey.trim()) {
          toast({ title: 'Chave PIX é obrigatória', variant: 'destructive' });
          return false;
        }
        if (!termsAccepted) {
          toast({ 
            title: 'Termos de Uso não aceitos', 
            description: 'Você precisa ler e aceitar os Termos de Uso para continuar.',
            variant: 'destructive' 
          });
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    
    const steps: Step[] = ['type', 'personal', 'address', 'payment'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['type', 'personal', 'address', 'payment'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    } else {
      onBack();
    }
  };

  const handleSubmit = async () => {
    if (!validateStep('payment')) return;
    
    setLoading(true);
    
    try {
      const profileData = userType === 'PF' 
        ? {
            user_type: 'PF' as const,
            full_name: fullName,
            display_name: displayName,
            cpf: cleanDocument(cpf),
            age: validateBirthDate(birthDate).age,
            address: {
              ...address,
              zip_code: cleanDocument(address.zip_code),
            },
            pix_key: pixKey,
            pix_key_type: pixKeyType,
            terms_accepted: termsAccepted,
          }
        : {
            user_type: 'PJ' as const,
            company_name: companyName,
            display_name: displayName,
            cnpj: cleanDocument(cnpj),
            address: {
              ...address,
              zip_code: cleanDocument(address.zip_code),
            },
            pix_key: pixKey,
            pix_key_type: pixKeyType,
            terms_accepted: termsAccepted,
          };

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Erro de autenticação',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('save-user-profile', {
        body: profileData,
      });

      if (error || !data?.success) {
        toast({
          title: 'Erro ao salvar perfil',
          description: data?.error || error?.message || 'Tente novamente.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      toast({
        title: 'Perfil criado!',
        description: 'Seu cadastro foi concluído com sucesso.',
      });

      onComplete();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao salvar perfil.',
        variant: 'destructive',
      });
    }
    
    setLoading(false);
  };

  // STEP 1: User Type
  if (step === 'type') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <CardTitle className="text-2xl font-display text-primary">
            Tipo de Conta
          </CardTitle>
          <CardDescription>
            Você é pessoa física ou jurídica?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={userType || ''}
            onValueChange={(v) => setUserType(v as UserType)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="PF"
                id="pf"
                className="peer sr-only"
              />
              <Label
                htmlFor="pf"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <User className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Pessoa Física</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="PJ"
                id="pj"
                className="peer sr-only"
              />
              <Label
                htmlFor="pj"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Building2 className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Pessoa Jurídica</span>
              </Label>
            </div>
          </RadioGroup>
          
          <Button className="w-full" onClick={nextStep} disabled={!userType}>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STEP 2: Personal/Company Info
  if (step === 'personal') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4"
            onClick={prevStep}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <CardTitle className="text-2xl font-display text-primary">
            {userType === 'PF' ? 'Dados Pessoais' : 'Dados da Empresa'}
          </CardTitle>
          <CardDescription>
            {userType === 'PF' ? 'Suas informações pessoais' : 'Informações da sua empresa'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userType === 'PF' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Como gostaria de ser chamado? *</Label>
                <Input
                  id="displayName"
                  placeholder="Ex: João"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => handleCPFChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento *</Label>
                <Input
                  id="birthDate"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={birthDate}
                  onChange={(e) => setBirthDate(formatDateBR(e.target.value))}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Razão Social *</Label>
                <Input
                  id="companyName"
                  placeholder="Nome da empresa"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome Fantasia *</Label>
                <Input
                  id="displayName"
                  placeholder="Como sua loja será exibida"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => handleCNPJChange(e.target.value)}
                />
              </div>
            </>
          )}
          
          <Button className="w-full" onClick={nextStep}>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STEP 3: Address
  if (step === 'address') {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4"
            onClick={prevStep}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <CardTitle className="text-2xl font-display text-primary flex items-center justify-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço
          </CardTitle>
          <CardDescription>
            Endereço completo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP *</Label>
            <Input
              id="zip_code"
              placeholder="00000-000"
              value={address.zip_code}
              onChange={(e) => handleCEPChange(e.target.value)}
              onBlur={() => fetchAddressByCEP(address.zip_code)}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="street">Rua *</Label>
              <Input
                id="street"
                placeholder="Nome da rua"
                value={address.street}
                onChange={(e) => setAddress(prev => ({ ...prev, street: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                placeholder="123"
                value={address.number}
                onChange={(e) => setAddress(prev => ({ ...prev, number: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              placeholder="Apto, bloco, etc"
              value={address.complement}
              onChange={(e) => setAddress(prev => ({ ...prev, complement: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro *</Label>
            <Input
              id="neighborhood"
              placeholder="Bairro"
              value={address.neighborhood}
              onChange={(e) => setAddress(prev => ({ ...prev, neighborhood: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                placeholder="Cidade"
                value={address.city}
                onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">UF *</Label>
              <Select
                value={address.state}
                onValueChange={(value) => setAddress(prev => ({ ...prev, state: value }))}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button className="w-full" onClick={nextStep}>
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STEP 4: Payment
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 top-4"
          onClick={prevStep}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <CardTitle className="text-2xl font-display text-primary flex items-center justify-center gap-2">
          <Wallet className="h-5 w-5" />
          Pagamento
        </CardTitle>
        <CardDescription>
          Configure sua chave PIX para receber pagamentos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo de Chave PIX *</Label>
          <Select
            value={pixKeyType}
            onValueChange={(value) => setPixKeyType(value as PixKeyType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="random">Chave Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="pixKey">Chave PIX *</Label>
          <Input
            id="pixKey"
            placeholder={
              pixKeyType === 'cpf' ? '000.000.000-00' :
              pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
              pixKeyType === 'email' ? 'seu@email.com' :
              pixKeyType === 'phone' ? '+5511999999999' :
              'Sua chave aleatória'
            }
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
          />
        </div>

        {/* Terms of Use Section */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer">
                Li e concordo com os Termos de Uso e Política de Privacidade *
              </Label>
            </div>
          </div>
          
          <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="link" size="sm" className="p-0 h-auto text-primary underline">
                {termsOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Fechar Termos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Ler Termos
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 p-3 bg-muted/50 rounded-md max-h-48 overflow-y-auto border border-border">
                <p className="text-sm text-muted-foreground italic">
                  Em revisão
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Security Message */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>Seus dados sensíveis (CPF, CNPJ, chave PIX) são criptografados e nunca são expostos.</p>
        </div>

        {/* Authenticity Warning */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Diga não às réplicas! O Kura preza pela autenticidade das peças.
          </p>
        </div>
        
        <Button 
          className="w-full" 
          onClick={handleSubmit} 
          disabled={loading || !termsAccepted}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Finalizar Cadastro
        </Button>
      </CardContent>
    </Card>
  );
}
