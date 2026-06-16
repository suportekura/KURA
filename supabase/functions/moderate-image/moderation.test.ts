// Testes da lógica pura de decisão (limiares + mapeamento).
// A chamada à OpenAI é "mockada": alimentamos `category_scores` sintéticos,
// nenhum request de rede é feito.
//
// Rodar: deno test supabase/functions/moderate-image/moderation.test.ts

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateImageModeration,
  parseCategoryScores,
  SAFETY_REVIEW_THRESHOLD,
  SEXUAL_REVIEW_THRESHOLD,
} from "./moderation.ts";
import type { OpenAIModerationResponse } from "./types.ts";

// Monta uma resposta da OpenAI mockada com os scores informados.
function mockResponse(
  scores: Record<string, number>,
  flagged = false,
): OpenAIModerationResponse {
  return {
    id: "modr-test",
    model: "omni-moderation-latest",
    results: [{ flagged, categories: {}, category_scores: scores }],
  };
}

// Baseline com todos os scores baixos.
const LOW: Record<string, number> = {
  sexual: 0.01,
  violence: 0.02,
  "violence/graphic": 0.0,
  "self-harm": 0.0,
  "self-harm/intent": 0.0,
  "self-harm/instructions": 0.0,
};

Deno.test("tudo baixo -> aprova", () => {
  const verdict = evaluateImageModeration(parseCategoryScores(mockResponse(LOW)));
  assertEquals(verdict.needsManualReview, false);
  assertEquals(verdict.reason, undefined);
});

Deno.test("decide pelos scores e IGNORA o booleano flagged", () => {
  // flagged=true, porém scores baixos -> ainda aprova.
  const verdict = evaluateImageModeration(
    parseCategoryScores(mockResponse(LOW, true)),
  );
  assertEquals(verdict.needsManualReview, false);
});

Deno.test("sexual alto -> revisão", () => {
  const verdict = evaluateImageModeration(
    parseCategoryScores(mockResponse({ ...LOW, sexual: 0.5 })),
  );
  assert(verdict.needsManualReview);
  assert(verdict.reason?.toLowerCase().includes("sexual"));
});

Deno.test("sexual exatamente no limiar -> revisão (>=)", () => {
  const verdict = evaluateImageModeration(
    parseCategoryScores(mockResponse({ ...LOW, sexual: SEXUAL_REVIEW_THRESHOLD })),
  );
  assert(verdict.needsManualReview);
});

Deno.test("violence alto -> revisão", () => {
  const verdict = evaluateImageModeration(
    parseCategoryScores(mockResponse({ ...LOW, violence: 0.8 })),
  );
  assert(verdict.needsManualReview);
  assert(verdict.reason?.includes("violence"));
});

Deno.test("self-harm/intent no limiar de safety -> revisão", () => {
  const verdict = evaluateImageModeration(
    parseCategoryScores(
      mockResponse({ ...LOW, "self-harm/intent": SAFETY_REVIEW_THRESHOLD }),
    ),
  );
  assert(verdict.needsManualReview);
});

Deno.test("safety logo abaixo do limiar -> aprova", () => {
  const verdict = evaluateImageModeration(
    parseCategoryScores(mockResponse({ ...LOW, violence: 0.69 })),
  );
  assertEquals(verdict.needsManualReview, false);
});

Deno.test("erro/resposta inválida -> revisão (fail-safe)", () => {
  // parse defensivo retorna null para formatos inesperados.
  assertEquals(parseCategoryScores(null), null);
  assertEquals(parseCategoryScores({} as OpenAIModerationResponse), null);
  assertEquals(parseCategoryScores({ results: [] }), null);

  // evaluate com null/garbage cai em revisão.
  assert(evaluateImageModeration(null).needsManualReview);
  assert(evaluateImageModeration(parseCategoryScores({ results: [{}] } as OpenAIModerationResponse)).needsManualReview);
});
