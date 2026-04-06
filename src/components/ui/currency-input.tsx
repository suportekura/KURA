import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Currency input with progressive cents approach.
 * User types: 1 → 0,01 | 10 → 0,10 | 100 → 1,00 | 1000 → 10,00
 */
export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
  className,
}: CurrencyInputProps) {
  // Convert value (in reais as string) to cents for internal state
  const [cents, setCents] = useState<number>(() => {
    if (value) {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : Math.round(num * 100);
    }
    return 0;
  });

  // Sync cents when external value changes (e.g., form reset, edit mode)
  useEffect(() => {
    const num = value ? parseFloat(value) : 0;
    const expectedCents = isNaN(num) ? 0 : Math.round(num * 100);
    if (expectedCents !== cents) {
      setCents(expectedCents);
    }
  }, [value]);

  // Format cents to display value
  const formatCentsToBRL = (c: number): string => {
    if (c === 0) return '';
    const val = c / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const displayValue = formatCentsToBRL(cents);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract only digits
    const digits = e.target.value.replace(/\D/g, '');
    
    // Convert to number (cents)
    const newCents = digits === '' ? 0 : parseInt(digits, 10);
    
    // Limit to max R$ 99.999,99 (9999999 cents)
    const limitedCents = Math.min(newCents, 9999999);
    
    setCents(limitedCents);
    
    // Report back value in reais
    const reaisValue = limitedCents > 0 ? (limitedCents / 100).toString() : '';
    onChange(reaisValue);
  }, [onChange]);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
        R$
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn('input-premium pl-10', className)}
        disabled={disabled}
      />
    </div>
  );
}
