export const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._]{1,28}[a-zA-Z0-9]$/;

export function isValidUsernameFormat(value: string): { valid: boolean; error?: string } {
  if (!value || value.length < 3) {
    return { valid: false, error: 'Mínimo de 3 caracteres' };
  }
  if (value.length > 30) {
    return { valid: false, error: 'Máximo de 30 caracteres' };
  }
  if (value.includes('..') || value.includes('__')) {
    return { valid: false, error: 'Não pode ter ".." ou "__" consecutivos' };
  }
  if (!USERNAME_REGEX.test(value)) {
    return { valid: false, error: 'Apenas letras, números, ponto (.) e _. Deve começar e terminar com letra ou número.' };
  }
  return { valid: true };
}

/**
 * Generates up to 3 username suggestions from a display name.
 * Strips accents, spaces and invalid chars; produces variant with no separator,
 * underscore, and dot.
 */
export function generateUsernameSuggestions(displayName: string): string[] {
  // Normalise: remove accents, lowercase, keep only valid chars
  const base = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')       // replace invalid chars with space
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (base.length === 0) return [];

  const joined = base.join('');
  const withUnderscore = base.join('_');
  const withDot = base.join('.');

  // Deduplicate and filter by format validity
  return [joined, withUnderscore, withDot]
    .filter((s, i, arr) => arr.indexOf(s) === i)   // unique
    .filter(s => isValidUsernameFormat(s).valid)    // valid format
    .slice(0, 3);
}
