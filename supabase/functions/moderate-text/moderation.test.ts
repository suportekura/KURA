// Testes da lógica pura de decisão do texto (limiares + mapeamento + flaggedField).
// A chamada à OpenAI é "mockada": alimentamos `category_scores` sintéticos.
//
// Rodar: deno test supabase/functions/moderate-text/moderation.test.ts

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  combineTextVerdict,
  evaluateField,
  parseCategoryScoresAt,
  TEXT_REJECT_THRESHOLD,
  TEXT_REVIEW_THRESHOLD,
} from "./moderation.ts";
import type { OpenAIModerationResponse } from "./types.ts";

// Monta uma resposta da OpenAI mockada com os scores de cada input (título, descrição).
function mockResponse(
  ...resultsScores: Record<string, number>[]
): OpenAIModerationResponse {
  return {
    id: "modr-test",
    model: "omni-moderation-latest",
    results: resultsScores.map((category_scores) => ({
      flagged: false,
      categories: {},
      category_scores,
    })),
  };
}

const LOW: Record<string, number> = { hate: 0.01, sexual: 0.0, violence: 0.02 };

// Avalia um par título/descrição a partir de uma resposta mockada.
function evalPair(resp: OpenAIModerationResponse, hasDescription = true) {
  const title = evaluateField(parseCategoryScoresAt(resp, 0));
  const description = hasDescription
    ? evaluateField(parseCategoryScoresAt(resp, 1))
    : null;
  return combineTextVerdict(title, description);
}

Deno.test("texto limpo -> aprova", () => {
  const v = evalPair(mockResponse(LOW, LOW));
  assertEquals(v.moderationFlagged, false);
  assertEquals(v.needsManualReview, false);
  assertEquals(v.reason, undefined);
});

Deno.test("decide pelos scores e IGNORA o booleano flagged", () => {
  const resp = mockResponse(LOW, LOW);
  resp.results![0].flagged = true; // mesmo com flagged=true, scores baixos -> aprova
  assertEquals(evalPair(resp).moderationFlagged, false);
});

Deno.test("hate alto no título -> rejeita, flaggedField=title", () => {
  const v = evalPair(mockResponse({ ...LOW, hate: 0.9 }, LOW));
  assert(v.moderationFlagged);
  assertEquals(v.flaggedField, "title");
  assertEquals(v.needsManualReview, false);
  assert(v.reason?.includes("hate"));
});

Deno.test("sexual alto na descrição -> rejeita, flaggedField=description", () => {
  const v = evalPair(mockResponse(LOW, { ...LOW, sexual: 0.8 }));
  assert(v.moderationFlagged);
  assertEquals(v.flaggedField, "description");
});

Deno.test("graves nos dois campos -> flaggedField=both", () => {
  const v = evalPair(mockResponse({ ...LOW, hate: 0.7 }, { ...LOW, violence: 0.6 }));
  assert(v.moderationFlagged);
  assertEquals(v.flaggedField, "both");
});

Deno.test("score intermediário -> revisão (não rejeita)", () => {
  // Entre REVIEW (0.20) e REJECT (0.50) -> needsManualReview, sem flag.
  const mid = (TEXT_REVIEW_THRESHOLD + TEXT_REJECT_THRESHOLD) / 2;
  const v = evalPair(mockResponse({ ...LOW, harassment: mid }, LOW));
  assertEquals(v.moderationFlagged, false);
  assert(v.needsManualReview);
  assert(v.reason?.toLowerCase().includes("revisão"));
});

Deno.test("categoria não-grave alta -> revisão (não rejeita)", () => {
  // 'harassment' (não está em SEVERE) com score alto: revisão, nunca reject.
  const v = evalPair(mockResponse({ ...LOW, harassment: 0.95 }, LOW));
  assertEquals(v.moderationFlagged, false);
  assert(v.needsManualReview);
});

Deno.test("limiares exatos: reject grave no limite, review no limite", () => {
  assertEquals(
    evaluateField({ hate: TEXT_REJECT_THRESHOLD }).level,
    "reject",
  );
  assertEquals(
    evaluateField({ hate: TEXT_REVIEW_THRESHOLD }).level,
    "review",
  );
  assertEquals(evaluateField({ hate: 0.0 }).level, "approve");
});

Deno.test("sem descrição -> avalia só o título", () => {
  const v = evalPair(mockResponse({ ...LOW, hate: 0.9 }), false);
  assert(v.moderationFlagged);
  assertEquals(v.flaggedField, "title");
});

Deno.test("erro/resposta inválida -> revisão (fail-safe)", () => {
  assertEquals(parseCategoryScoresAt(null, 0), null);
  assertEquals(parseCategoryScoresAt({} as OpenAIModerationResponse, 0), null);
  assertEquals(parseCategoryScoresAt({ results: [] }, 0), null);

  // scores nulos no título -> evaluateField cai em review -> verdict review.
  const titleDecision = evaluateField(null);
  assertEquals(titleDecision.unavailable, true);
  const v = combineTextVerdict(titleDecision, null);
  assertEquals(v.moderationFlagged, false);
  assert(v.needsManualReview);
  // Motivo deve ser específico (falha técnica), não "conteúdo sensível".
  assert(v.reason?.includes("não foi possível avaliar"));
  assert(!v.reason?.includes("conteúdo sensível"));
});

Deno.test("descrição ausente nos results (bug do input) -> motivo técnico", () => {
  // Reproduz o cenário corrigido: results só tem o título (índice 0); a
  // descrição (índice 1) não existe -> parse null -> motivo técnico, não conteúdo.
  const resp = mockResponse(LOW); // só 1 result
  const title = evaluateField(parseCategoryScoresAt(resp, 0)); // ok
  const description = evaluateField(parseCategoryScoresAt(resp, 1)); // null -> unavailable
  const v = combineTextVerdict(title, description);
  assert(v.needsManualReview);
  assertEquals(v.flaggedField, undefined);
  assert(v.reason?.includes("Descrição: não foi possível avaliar"));
});
