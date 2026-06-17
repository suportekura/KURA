// Tipos do request/response da OpenAI Moderation API e do veredito interno
// da moderação de imagem. Mantém o contrato consumido pelo cliente (Sell.tsx)
// estável — não renomeie os campos de ModerationResult.

/**
 * Categorias de `category_scores` aplicáveis a IMAGEM.
 * As categorias text-only da OpenAI (hate, harassment, illicit, sexual/minors)
 * NÃO se aplicam a input de imagem e são ignoradas nesta função.
 */
export type ImageSafetyCategory =
  | "sexual"
  | "violence"
  | "violence/graphic"
  | "self-harm"
  | "self-harm/intent"
  | "self-harm/instructions";

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

/**
 * Veredito da camada de decisão pura (sem I/O).
 * A função NUNCA reprova sozinha: só aprova (needsManualReview=false) ou
 * envia para revisão humana (needsManualReview=true).
 */
export interface ImageModerationVerdict {
  needsManualReview: boolean;
  /** Motivo legível (PT-BR), presente apenas quando vai para revisão. */
  reason?: string;
  /** Scores das categorias de imagem avaliadas — para log/debug. */
  scores: Record<string, number>;
}

/**
 * Contrato devolvido ao cliente (Sell.tsx). NÃO alterar os nomes dos campos:
 * o cliente depende deles (Sell.tsx:55-64).
 *
 * `moderationFlagged` é sempre `false` neste fluxo — esta função só APROVA ou
 * envia para REVISÃO HUMANA, nunca reprova/inativa por conta própria. Conteúdo
 * sinalizado segue para `pending_review` via `needsManualReview=true`.
 */
export interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  reason?: string;
  error?: string;
  // Aditivos para o modal de revisão no client (régua de 2 níveis). Presentes
  // apenas no caminho de flag de conteúdo; ausentes no fail-safe de erro.
  /** Scores por categoria de imagem (ex.: { sexual: 0.93, violence: 0.01, ... }). */
  categoryScores?: Record<string, number>;
  /** Categoria dominante (maior score relevante) — para a mensagem do modal. */
  category?: string;
}
