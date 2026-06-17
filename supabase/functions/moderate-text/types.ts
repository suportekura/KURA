// Tipos do request/response da OpenAI Moderation API e do veredito interno
// da moderação de TEXTO. Mantém o contrato consumido pelo cliente (Sell.tsx)
// estável — não renomeie os campos de TextModerationResult.

/** Categorias de `category_scores` aplicáveis a TEXTO (todas se aplicam). */
export type TextModerationCategory =
  | "sexual"
  | "sexual/minors"
  | "harassment"
  | "harassment/threatening"
  | "hate"
  | "hate/threatening"
  | "illicit"
  | "illicit/violent"
  | "self-harm"
  | "self-harm/intent"
  | "self-harm/instructions"
  | "violence"
  | "violence/graphic";

/** Um item de `results` da resposta da OpenAI (campos que consumimos). */
export interface OpenAIModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

/** Resposta de POST https://api.openai.com/v1/moderations. */
export interface OpenAIModerationResponse {
  id?: string;
  model?: string;
  results?: OpenAIModerationResult[];
}

/** Qual campo foi sinalizado, para a mensagem ao usuário. */
export type FlaggedField = "title" | "description" | "both";

/**
 * Veredito da camada de decisão pura (sem I/O), modelo HÍBRIDO:
 * - categoria grave com score alto  -> moderationFlagged=true (rejeita na hora)
 * - score limítrofe                  -> needsManualReview=true (fila humana)
 * - caso contrário                   -> aprovado
 */
export interface TextModerationVerdict {
  moderationFlagged: boolean;
  flaggedField?: FlaggedField;
  needsManualReview: boolean;
  /** Motivo legível (PT-BR), presente quando rejeita ou vai para revisão. */
  reason?: string;
  confidenceScore: number;
}

/**
 * Contrato devolvido ao cliente (Sell.tsx). NÃO alterar os nomes dos campos:
 * o cliente depende deles (Sell.tsx:133-142, consumidos em :727-750).
 */
export interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: FlaggedField;
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}
