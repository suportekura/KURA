// CPF and CNPJ validation following official Brazilian algorithms

/**
 * Remove all non-digit characters
 */
export function cleanDocument(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

/**
 * Format CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  if (cleaned.length <= 12) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}

/**
 * Format CEP: 00000-000
 */
export function formatCEP(value: string): string {
  const cleaned = cleanDocument(value);
  if (cleaned.length <= 5) return cleaned;
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
}

/**
 * Validate CPF using official algorithm from Receita Federal
 * Rules:
 * - Must have 11 digits
 * - Cannot be a repeated sequence (00000000000, 11111111111, etc.)
 * - Must pass verification digit check
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);
  
  // Must have 11 digits
  if (cleaned.length !== 11) {
    return false;
  }
  
  // Check for repeated sequences
  const allSame = /^(\d)\1{10}$/.test(cleaned);
  if (allSame) {
    return false;
  }
  
  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) {
    return false;
  }
  
  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) {
    return false;
  }
  
  return true;
}

/**
 * Validate CNPJ using official algorithm from Receita Federal
 * Rules:
 * - Must have 14 digits
 * - Cannot be a repeated sequence
 * - Must pass verification digit check
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);
  
  // Must have 14 digits
  if (cleaned.length !== 14) {
    return false;
  }
  
  // Check for repeated sequences
  const allSame = /^(\d)\1{13}$/.test(cleaned);
  if (allSame) {
    return false;
  }
  
  // Calculate first verification digit
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * firstWeights[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cleaned.charAt(12))) {
    return false;
  }
  
  // Calculate second verification digit
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * secondWeights[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cleaned.charAt(13))) {
    return false;
  }
  
  return true;
}

/**
 * Validate PIX key format
 */
export function validatePixKey(key: string, type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'): boolean {
  const cleaned = cleanDocument(key);
  
  switch (type) {
    case 'cpf':
      return validateCPF(key);
    case 'cnpj':
      return validateCNPJ(key);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case 'phone':
      return /^\+55\d{10,11}$/.test(cleaned) || /^\d{10,11}$/.test(cleaned);
    case 'random':
      return key.length >= 32 && key.length <= 36;
    default:
      return false;
  }
}

/**
 * Validate age (must be 18+)
 */
export function validateAge(age: number): boolean {
  return Number.isInteger(age) && age >= 18 && age <= 150;
}

/**
 * Format date input as DD/MM/YYYY
 */
export function formatDateBR(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Parse DD/MM/YYYY string to Date object
 */
export function parseDateBR(value: string): Date | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const day = parseInt(digits.slice(0, 2));
  const month = parseInt(digits.slice(2, 4));
  const year = parseInt(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * Calculate age from birth date
 */
export function calculateAgeFromDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Validate birth date (must result in 18+ years old)
 */
export function validateBirthDate(value: string): { valid: boolean; age: number; error?: string } {
  const date = parseDateBR(value);
  if (!date) return { valid: false, age: 0, error: 'Data inválida. Use o formato DD/MM/AAAA.' };
  const age = calculateAgeFromDate(date);
  if (age < 18) return { valid: false, age, error: 'Você deve ter pelo menos 18 anos.' };
  if (age > 150) return { valid: false, age, error: 'Data de nascimento inválida.' };
  return { valid: true, age };
}
