import { useState, useCallback } from 'react';

/**
 * Format cents to BRL currency string (e.g., "1.234,56")
 */
export function formatCentsToBRL(cents: number): string {
  if (cents === 0) return '';
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number to BRL currency string (e.g., "1.234,56")
 */
export function formatToBRL(value: number | string | undefined): string {
  if (value === undefined || value === '' || value === null) return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

/**
 * Format a number to full BRL currency string with symbol (e.g., "R$ 1.234,56")
 */
export function formatToBRLFull(value: number | string | undefined): string {
  if (value === undefined || value === '' || value === null) return '';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

/**
 * Parse a BRL formatted string to number
 */
export function parseBRLToNumber(value: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  
  // Remove currency symbol and spaces
  let cleaned = value.replace(/R\$\s?/g, '').trim();
  
  // Replace thousand separators (.) and convert decimal separator (, to .)
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Hook for managing BRL currency input with progressive cents approach.
 * User types: 1 → 0,01 | 10 → 0,10 | 100 → 1,00 | 1000 → 10,00
 * This ensures fluid typing without cursor issues.
 */
export function useCurrencyInput(initialValue: string = '') {
  const [cents, setCents] = useState<number>(() => {
    if (initialValue) {
      const num = parseFloat(initialValue);
      return isNaN(num) ? 0 : Math.round(num * 100);
    }
    return 0;
  });
  
  // Display value formatted from cents
  const displayValue = cents > 0 ? formatCentsToBRL(cents) : '';
  
  const handleChange = useCallback((inputValue: string) => {
    // Extract only digits
    const digits = inputValue.replace(/\D/g, '');
    
    // Convert to number (cents)
    const newCents = digits === '' ? 0 : parseInt(digits, 10);
    
    // Limit to max R$ 99.999,99 (9999999 cents)
    const limitedCents = Math.min(newCents, 9999999);
    
    setCents(limitedCents);
    
    // Return the numeric value in reais for form state
    return limitedCents > 0 ? (limitedCents / 100).toString() : '';
  }, []);
  
  const setValue = useCallback((value: string) => {
    if (value) {
      const num = parseFloat(value);
      setCents(isNaN(num) ? 0 : Math.round(num * 100));
    } else {
      setCents(0);
    }
  }, []);
  
  const getNumericValue = useCallback((): string => {
    return cents > 0 ? (cents / 100).toString() : '';
  }, [cents]);
  
  const clear = useCallback(() => {
    setCents(0);
  }, []);
  
  return {
    displayValue,
    handleChange,
    setValue,
    getNumericValue,
    clear,
    cents,
  };
}
