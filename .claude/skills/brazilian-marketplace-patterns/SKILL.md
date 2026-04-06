---
name: brazilian-marketplace-patterns
description: Use when working with Brazilian-specific validation (CPF, CNPJ, CEP), currency formatting (BRL, reais), date formatting (DD/MM/YYYY), PIX key validation, age verification, document formatting, or Portuguese (pt-BR) UI text. Trigger on keywords like "CPF", "CNPJ", "CEP", "PIX", "BRL", "reais", "real", "centavos", "moeda", "currency", "date format", "DD/MM/YYYY", "age verification", "documento", "formatação", "validação", "Brazilian", "pt-BR", "locale", "Zod schema", "form validation", "useCurrencyInput", "validateCPF", "validateCNPJ", "formatCPF", "formatCNPJ", "formatCEP".
---

# Brazilian Marketplace Patterns

This skill documents all Brazilian-specific patterns used in Kura: document validation (CPF/CNPJ), currency handling (BRL), date formatting, PIX key validation, and pt-BR UI conventions. Core implementations are in `src/lib/validations.ts` and `src/hooks/useCurrencyInput.ts`.

## When to use this skill

- Validating Brazilian documents (CPF, CNPJ)
- Formatting or parsing BRL currency values
- Working with Brazilian date formats (DD/MM/YYYY)
- Validating PIX keys
- Adding age verification (18+)
- Writing pt-BR UI text
- Working with CEP (postal codes)
- Handling form validation with Zod schemas

## Core Patterns

### 1. CPF Validation (Pessoa Física)

From `src/lib/validations.ts` — official Receita Federal Mod11 algorithm:

```typescript
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;

  // Reject known invalid sequences (all same digit)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // First verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  // Second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}
```

### 2. CNPJ Validation (Pessoa Jurídica)

```typescript
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false;

  // Weights for first digit: 5,4,3,2,9,8,7,6,5,4,3,2
  // Weights for second digit: 6,5,4,3,2,9,8,7,6,5,4,3,2
  // ... Mod11 algorithm
}
```

### 3. Document Formatting

```typescript
// CPF: 123.456.789-09
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// CNPJ: 12.345.678/0001-90
export function formatCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// CEP: 01234-567
export function formatCEP(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  return cleaned.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

// Clean document (remove formatting)
export function cleanDocument(value: string): string {
  return value.replace(/\D/g, '');
}
```

### 4. BRL Currency Handling

From `src/hooks/useCurrencyInput.ts` — cents-based approach:

```typescript
// Format cents to display string (no symbol)
export function formatCentsToBRL(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `${reais.toLocaleString('pt-BR')},${centavos.toString().padStart(2, '0')}`;
}

// Format number to BRL string (no symbol)
export function formatToBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Format with symbol
export function formatToBRLFull(value: number): string {
  return `R$ ${formatToBRL(value)}`;
}

// Parse BRL string to number
export function parseBRLToNumber(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Currency input hook (progressive cents approach)
export function useCurrencyInput(initialValue = 0) {
  const [cents, setCents] = useState(initialValue);

  const handleChange = (inputValue: string) => {
    const digits = inputValue.replace(/\D/g, '');
    const newCents = parseInt(digits, 10) || 0;
    // Max: R$ 99.999,99
    setCents(Math.min(newCents, 9999999));
  };

  const displayValue = formatCentsToBRL(cents);
  const getNumericValue = () => cents / 100;

  return { displayValue, handleChange, setValue: setCents, getNumericValue, clear: () => setCents(0), cents };
}
```

Usage in components:
```tsx
const { displayValue, handleChange, getNumericValue } = useCurrencyInput();

<Input
  value={displayValue}
  onChange={(e) => handleChange(e.target.value)}
  placeholder="0,00"
  inputMode="numeric"
/>

// When saving to DB:
const priceInReais = getNumericValue(); // e.g., 39.90
```

### 5. PIX Key Validation

```typescript
export function validatePixKey(key: string, type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'): boolean {
  switch (type) {
    case 'cpf':
      return validateCPF(key);
    case 'cnpj':
      return validateCNPJ(key);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case 'phone':
      // +55 prefix required, 11 digits
      const cleaned = key.replace(/\D/g, '');
      return cleaned.length === 13 && cleaned.startsWith('55');
    case 'random':
      // UUID-like format, 32-36 chars
      return key.length >= 32 && key.length <= 36;
  }
}
```

### 6. Date Handling (DD/MM/YYYY)

```typescript
// Format to Brazilian date
export function formatDateBR(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Parse from Brazilian date
export function parseDateBR(value: string): Date | null {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

// Age calculation
export function calculateAgeFromDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Birth date validation (18+ required)
export function validateBirthDate(value: string): { valid: boolean; age?: number; error?: string } {
  const date = parseDateBR(value);
  if (!date) return { valid: false, error: 'Data inválida' };

  const age = calculateAgeFromDate(date);
  if (age < 18) return { valid: false, age, error: 'Você deve ter pelo menos 18 anos' };
  if (age > 150) return { valid: false, error: 'Data inválida' };

  return { valid: true, age };
}
```

### 7. Zod Validation Schemas

From `src/lib/validations.ts`:

```typescript
import { z } from 'zod';

export const emailSchema = z.string().min(1, 'Email obrigatório').email('Email inválido');

export const passwordSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/\d/, 'Deve conter pelo menos um número')
  .regex(/[a-zA-Z]/, 'Deve conter pelo menos uma letra');

export const fullNameSchema = z.string()
  .min(2, 'Nome deve ter pelo menos 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres');

export const verificationCodeSchema = z.string()
  .length(6, 'Código deve ter 6 dígitos')
  .regex(/^\d+$/, 'Apenas números');

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});
```

### 8. Product Categories (Brazilian Fashion)

```typescript
// From types/index.ts
type ProductCategory =
  | 'camiseta'        // T-shirt
  | 'calca'           // Pants
  | 'vestido'         // Dress
  | 'jaqueta'         // Jacket
  | 'saia'            // Skirt
  | 'shorts'          // Shorts
  | 'blazer'          // Blazer
  | 'casaco'          // Coat
  | 'acessorios'      // Accessories
  | 'calcados'        // Shoes
  | 'camisa'          // Shirt
  | 'bolsas_carteiras' // Bags & Wallets
  | 'bodies'          // Bodysuits
  | 'roupas_intimas'  // Underwear
  | 'moda_praia'      // Swimwear
  | 'roupas_esportivas' // Sportswear
  | 'bones_chapeus'   // Caps & Hats
  | 'oculos'          // Sunglasses
  | 'lencos_cachecois' // Scarves
  | 'roupas_infantis' // Kids
  | 'outros';         // Other

type ProductGender = 'M' | 'F' | 'U'; // Male, Female, Unisex
```

### 9. Encrypted Document Storage

CPF and CNPJ are encrypted with AES-256-GCM before storing in the database:

```typescript
// In Edge Functions (server-side only)
// Encrypt
const key = Deno.env.get('ENCRYPTION_KEY'); // 32-byte hex key
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  cryptoKey,
  new TextEncoder().encode(cpf)
);
// Store: cpf_encrypted (base64), cpf_iv (base64), cpf_tag (base64)

// Decrypt (when needed for payment processing)
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv: storedIv },
  cryptoKey,
  storedEncrypted
);
const cpf = new TextDecoder().decode(decrypted);
```

## Step-by-step Guide

### Adding a new validated field (Brazilian document)

1. Add validation function in `src/lib/validations.ts`
2. Add formatting function in the same file
3. Add Zod schema if used in forms
4. In the form component, apply mask on input change
5. Validate on submit
6. If sensitive, encrypt server-side before storing (see Edge Function pattern)

### Adding currency input to a form

1. Import `useCurrencyInput` from `@/hooks/useCurrencyInput`
2. Use `displayValue` for the input, `handleChange` for onChange
3. Set `inputMode="numeric"` on the input element
4. Use `getNumericValue()` when submitting to get the float value
5. Use `formatToBRLFull()` for display-only values

## Common Mistakes to Avoid

1. **Never store CPF/CNPJ in plain text** — always encrypt with AES-256-GCM server-side
2. **Currency is always in centavos for APIs** — R$ 39,90 = 3990 when sending to Pagar.me
3. **Don't use JavaScript `Date` parsing with DD/MM/YYYY** — `new Date('23/03/2026')` fails; use `parseDateBR()`
4. **Don't forget age verification** — Brazilian law requires 18+ for marketplace transactions
5. **Don't validate CPF/CNPJ with regex only** — use the full Mod11 algorithm; regex catches format but not checksum
6. **Phone numbers need +55 prefix** for PIX — don't accept without country code
7. **All error messages must be in Portuguese** — e.g., "Email obrigatório", not "Email required"

## Checklist

- [ ] CPF/CNPJ validated with full Mod11 algorithm (not just regex)
- [ ] Currency values displayed with `formatToBRL()` or `formatToBRLFull()`
- [ ] Currency input uses `useCurrencyInput()` hook (cents-based)
- [ ] Dates formatted as DD/MM/YYYY using `formatDateBR()`
- [ ] Age verification (18+) on birth date fields
- [ ] PIX key validated by type (cpf, cnpj, email, phone, random)
- [ ] Sensitive documents encrypted server-side (AES-256-GCM)
- [ ] All user-facing text in pt-BR
- [ ] Form validation messages in Portuguese
