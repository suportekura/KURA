// Lógica pura de decisão da moderação de imagem (sem I/O).
// Decide pelos `category_scores` E pelas flags por categoria (`categories`) que
// a OpenAI devolve — a flag por categoria é calibrada por eles e pega nudez que
// fica abaixo do nosso limiar de score. Não usamos o agregado `flagged` solto.
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
export const SEXUAL_REVIEW_THRESHOLD = 0.20; // baixo: nudez pontua moderado em `sexual` (CSAM via fila humana)
export const SAFETY_REVIEW_THRESHOLD = 0.50; // violence, violence/graphic, self-harm*

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
 * Categoria de imagem com o maior score (e o score). Usada para informar ao
 * client qual a categoria dominante (mensagem do modal de revisão). Scores
 * ausentes/inválidos -> { category: "", score: 0 }.
 */
export function dominantCategory(
  scores: Record<string, number> | null | undefined,
): { category: string; score: number } {
  let category = "";
  let score = 0;
  if (scores && typeof scores === "object") {
    for (const cat of IMAGE_CATEGORIES) {
      const v = scores[cat];
      const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
      if (n > score) {
        score = n;
        category = cat;
      }
    }
  }
  return { category, score };
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
  categories?: Record<string, boolean> | null,
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

  // (1) Honra a decisão calibrada da OpenAI: se ELA marcou qualquer categoria
  // de imagem como `true` (ex.: nudez explícita), vai para revisão mesmo que o
  // nosso score fique abaixo do limiar — pega a nudez que escapava.
  if (categories) {
    for (const cat of IMAGE_CATEGORIES) {
      if (categories[cat] === true) {
        return {
          needsManualReview: true,
          reason:
            `Conteúdo sinalizado pela OpenAI (${cat}). Revisão manual necessária.`,
          scores: relevantScores,
        };
      }
    }
  }

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
