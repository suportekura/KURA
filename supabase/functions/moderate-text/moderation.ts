// Lógica pura de decisão da moderação de TEXTO (sem I/O).
// Decide pelos `category_scores` da OpenAI — nunca pelo booleano `flagged`.
//
// Modelo HÍBRIDO:
//   - categoria GRAVE com score >= TEXT_REJECT_THRESHOLD -> rejeita na hora
//     (moderationFlagged), com feedback imediato e flaggedField.
//   - qualquer categoria com score >= TEXT_REVIEW_THRESHOLD (mas sem reject)
//     -> revisão humana (needsManualReview).
//   - caso contrário -> aprovado.
//
// Título e descrição são avaliados separadamente para derivar o flaggedField.

import type {
  FlaggedField,
  OpenAIModerationResponse,
  TextModerationCategory,
  TextModerationVerdict,
} from "./types.ts";

// ── Limiares (ajuste aqui sem mexer na lógica) ─────────────────────────────
export const TEXT_REJECT_THRESHOLD = 0.50; // score alto em categoria grave -> rejeita
export const TEXT_REVIEW_THRESHOLD = 0.20; // suspeita -> revisão humana

// Categorias graves: reprovação imediata quando o score passa o REJECT.
export const SEVERE_CATEGORIES: TextModerationCategory[] = [
  "sexual",
  "sexual/minors",
  "hate",
  "hate/threatening",
  "violence",
  "violence/graphic",
  "harassment/threatening",
  "self-harm/intent",
  "self-harm/instructions",
  "illicit/violent",
];

// Todas as categorias de texto (usadas no tier de revisão).
export const ALL_TEXT_CATEGORIES: TextModerationCategory[] = [
  "sexual",
  "sexual/minors",
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "illicit",
  "illicit/violent",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "violence",
  "violence/graphic",
];

export type FieldLevel = "approve" | "review" | "reject";

export interface FieldDecision {
  level: FieldLevel;
  /** Categoria de maior peso que determinou o nível (se houver). */
  category?: string;
  /** Maior score relevante encontrado no campo. */
  score: number;
}

/**
 * Extrai `results[index].category_scores` de forma defensiva.
 * Retorna `null` se a resposta não tiver o formato esperado.
 */
export function parseCategoryScoresAt(
  response: OpenAIModerationResponse | null | undefined,
  index: number,
): Record<string, number> | null {
  const scores = response?.results?.[index]?.category_scores;
  if (!scores || typeof scores !== "object") return null;
  return scores as Record<string, number>;
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function topCategory(
  scores: Record<string, number>,
  categories: TextModerationCategory[],
): { category: string; score: number } {
  let category = "";
  let score = 0;
  for (const cat of categories) {
    const v = scores[cat];
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    if (n > score) {
      score = n;
      category = cat;
    }
  }
  return { category, score };
}

/**
 * Avalia os scores de um único campo (título ou descrição).
 * Scores ausentes/inválidos -> `review` (fail-safe).
 */
export function evaluateField(
  scores: Record<string, number> | null | undefined,
): FieldDecision {
  if (!scores || typeof scores !== "object") {
    return { level: "review", score: 0 };
  }

  const severe = topCategory(scores, SEVERE_CATEGORIES);
  if (severe.score >= TEXT_REJECT_THRESHOLD) {
    return { level: "reject", category: severe.category, score: severe.score };
  }

  const any = topCategory(scores, ALL_TEXT_CATEGORIES);
  if (any.score >= TEXT_REVIEW_THRESHOLD) {
    return { level: "review", category: any.category, score: any.score };
  }

  return { level: "approve", score: any.score };
}

const FIELD_LABEL: Record<"title" | "description", string> = {
  title: "Título",
  description: "Descrição",
};

function fieldReason(
  field: "title" | "description",
  decision: FieldDecision,
): string {
  const cat = decision.category ? ` (${decision.category}, ${pct(decision.score)})` : "";
  return `${FIELD_LABEL[field]}: possível conteúdo sensível${cat}.`;
}

/**
 * Combina os vereditos de título e descrição num único veredito.
 * `description` pode ser `null` quando não há descrição para moderar.
 */
export function combineTextVerdict(
  titleDecision: FieldDecision,
  descriptionDecision: FieldDecision | null,
): TextModerationVerdict {
  const fields: { name: "title" | "description"; d: FieldDecision }[] = [
    { name: "title", d: titleDecision },
  ];
  if (descriptionDecision) fields.push({ name: "description", d: descriptionDecision });

  const confidenceScore = fields.reduce((max, f) => Math.max(max, f.d.score), 0);

  const rejects = fields.filter((f) => f.d.level === "reject");
  if (rejects.length > 0) {
    const flaggedField: FlaggedField = rejects.length >= 2
      ? "both"
      : rejects[0].name;
    return {
      moderationFlagged: true,
      flaggedField,
      needsManualReview: false,
      reason: rejects.map((f) => fieldReason(f.name, f.d)).join(" "),
      confidenceScore,
    };
  }

  const reviews = fields.filter((f) => f.d.level === "review");
  if (reviews.length > 0) {
    return {
      moderationFlagged: false,
      needsManualReview: true,
      reason: `${reviews.map((f) => fieldReason(f.name, f.d)).join(" ")} Revisão manual necessária.`,
      confidenceScore,
    };
  }

  return {
    moderationFlagged: false,
    needsManualReview: false,
    confidenceScore,
  };
}
