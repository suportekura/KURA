import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isValidUsernameFormat, generateUsernameSuggestions } from '@/lib/usernameValidation';
import { cn } from '@/lib/utils';

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function UsernameSetupSheet() {
  const { user, profileStatus, markUsernameSet } = useAuth();
  const [value, setValue] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [formatError, setFormatError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate suggestions from user metadata
  useEffect(() => {
    const name = user?.user_metadata?.full_name || '';
    if (name) setSuggestions(generateUsernameSuggestions(name));
  }, [user]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const checkAvailability = async (username: string) => {
    setCheckState('checking');
    const { data } = await supabase
      .from('public_profiles')
      .select('user_id')
      .ilike('username', username)
      .maybeSingle();
    setCheckState(data === null ? 'available' : 'taken');
  };

  const handleChange = (raw: string) => {
    setValue(raw);
    setSaveError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const { valid, error } = isValidUsernameFormat(raw);
    if (!valid) {
      setFormatError(error || null);
      setCheckState('invalid');
      return;
    }

    setFormatError(null);
    setCheckState('idle');
    debounceRef.current = setTimeout(() => checkAvailability(raw), 500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setSaveError(null);
    setFormatError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    checkAvailability(suggestion);
  };

  const handleSave = async () => {
    if (!user || checkState !== 'available') return;
    setSaving(true);
    setSaveError(null);

    const { error } = await supabase
      .from('profiles')
      .update({ username: value })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        setSaveError('Este @username acabou de ser escolhido por outra pessoa. Tente outro.');
        setCheckState('taken');
      } else {
        setSaveError('Erro ao salvar. Tente outro username ou tente novamente.');
      }
      return;
    }

    markUsernameSet();
  };

  const borderColor = {
    idle: 'border-border',
    checking: 'border-border',
    available: 'border-green-500',
    taken: 'border-destructive',
    invalid: 'border-amber-500',
  }[checkState];

  const statusMessage = {
    idle: null,
    checking: <span className="text-muted-foreground">⏳ Verificando disponibilidade...</span>,
    available: <span className="text-green-600">✓ @{value} está disponível</span>,
    taken: <span className="text-destructive">✗ @{value} já está em uso</span>,
    invalid: <span className="text-amber-600">{formatError}</span>,
  }[checkState];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="bg-background w-full rounded-t-2xl p-6 space-y-5">
        {/* Handle */}
        <div className="w-10 h-1 bg-muted rounded-full mx-auto" />

        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">Escolha seu @username</h2>
          <p className="text-sm text-muted-foreground">
            É seu identificador único na Kura. Você pode alterar uma vez a cada 30 dias após a primeira mudança.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-semibold select-none">@</span>
            <Input
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="seu.username"
              className={cn('pl-7 transition-colors', borderColor)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Letras, números, ponto (.) e _ • 3 a 30 caracteres</p>
          {statusMessage && <p className="text-xs mt-1">{statusMessage}</p>}
          {saveError && <p className="text-xs text-destructive mt-1">{saveError}</p>}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Sugestões:</p>
            <div className="flex gap-2 flex-wrap">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                >
                  @{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={checkState !== 'available' || saving}
          className="w-full"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Confirmar @username
        </Button>
      </div>
    </div>
  );
}
