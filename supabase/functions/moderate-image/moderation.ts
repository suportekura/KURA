// Lógica pura de decisão da moderação de imagem (sem I/O).
// Decide pelos `category_scores` da OpenAI — nunca pelo booleano `flagged`.
//
// A função só APROVA ou ENVIA PARA REVISÃO HUMANA. Nunca reprova/inativa
// sozinha: a fila humana (pending_review) é o backstop. Isso é proposital —
// a OpenAI NÃO aplica `sexual/minors` a input de imagem, então o limiar de
// `sexual` é conservador e qualquer suspeita vai para um humano decidir.

import type {
  ImageModerationVerdict,
  ImageSafetyCategory,
  OpenAIModerationResponse,
} from "./types.ts";

// ── Limiares de decisão (ajuste aqui sem mexer na lógica) ──────────────────
export const SEXUAL_REVIEW_THRESHOLD = 0.30; // conservador de propósito (ver nota CSAM)
export const SAFETY_REVIEW_THRESHOLD = 0.70; // violence, violence/graphic, self-harm*

// `sexual` tem limiar próprio (mais baixo); as demais compartilham SAFETY.
export const SEXUAL_CATEGORY: ImageSafetyCategory = "sexual";
export const SAFETY_CATEGORIES: ImageSafetyCategory[] = [
  "violence",
  "violence/graphic",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
];

// Todas as categorias de imagem que extraímos (sexual/minors NÃO entra: é
// inaplicável a imagem na OpenAI).
export const IMAGE_CATEGORIES: ImageSafetyCategory[] = [
  SEXUAL_CATEGORY,
  ...SAFETY_CATEGORIES,
];

/**
 * Extrai `results[0].category_scores` de forma defensiva.
 * Retorna `null` se a resposta não tiver o formato esperado.
 */
export function parseCategoryScores(
  response: OpenAIModerationResponse | null | undefined,
): Record<string, number> | null {
  const scores = response?.results?.[0]?.category_scores;
  if (!scores || typeof scores !== "object") return null;
  return scores as Record<string, number>;
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Decide o veredito a partir dos `category_scores`.
 * - `sexual` >= SEXUAL_REVIEW_THRESHOLD          -> revisão humana
 * - max(safety) >= SAFETY_REVIEW_THRESHOLD       -> revisão humana
 * - scores ausentes / formato inválido           -> revisão humana (fail-safe)
 * - caso contrário                               -> aprovado
 */
export function evaluateImageModeration(
  scores: Record<string, number> | null | undefined,
): ImageModerationVerdict {
  if (!scores || typeof scores !== "object") {
    return {
      needsManualReview: true,
      reason:
        "Resposta da moderação em formato inesperado. Revisão manual necessária.",
      scores: {},
    };
  }

  const getScore = (cat: string): number => {
    const v = scores[cat];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };

  // Subconjunto relevante (só categorias de imagem) para log/debug.
  const relevantScores: Record<string, number> = {};
  for (const cat of IMAGE_CATEGORIES) relevantScores[cat] = getScore(cat);

  const sexualScore = getScore(SEXUAL_CATEGORY);
  if (sexualScore >= SEXUAL_REVIEW_THRESHOLD) {
    return {
      needsManualReview: true,
      reason:
        `Possível conteúdo sexual detectado (${pct(sexualScore)}). Revisão manual necessária.`,
      scores: relevantScores,
    };
  }

  let topSafetyCategory: ImageSafetyCategory | null = null;
  let topSafetyScore = 0;
  for (const cat of SAFETY_CATEGORIES) {
    const s = getScore(cat);
    if (s > topSafetyScore) {
      topSafetyScore = s;
      topSafetyCategory = cat;
    }
  }

  if (topSafetyScore >= SAFETY_REVIEW_THRESHOLD) {
    return {
      needsManualReview: true,
      reason:
        `Possível conteúdo sensível (${topSafetyCategory}, ${pct(topSafetyScore)}). Revisão manual necessária.`,
      scores: relevantScores,
    };
  }

  return {
    needsManualReview: false,
    scores: relevantScores,
  };
}
