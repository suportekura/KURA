import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  dominantCategory,
  evaluateImageModeration,
  parseCategoryScores,
  SAFETY_REVIEW_THRESHOLD,
  SEXUAL_CATEGORY,
  SEXUAL_REVIEW_THRESHOLD,
} from "./moderation.ts";
import type { ModerationResult, OpenAIModerationResponse } from "./types.ts";

// Rate limiting: 20 requests per minute per user
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");

  if (!redisUrl || !redisToken) {
    console.warn("[moderate-image] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:moderate-image",
  });
}

// Timeout por tentativa de chamada à OpenAI (via AbortController).
const OPENAI_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

// Versão reduzida opcional enviada pelo cliente (data URI). Quando válida, vai
// como data URL para a OpenAI; caso contrário usamos a URL pública do Storage
// (a OpenAI busca a imagem pela URL — não precisamos baixar/encodar aqui).
const MAX_INLINE_IMAGE_CHARS = 1_400_000; // ~1MB após decode do base64

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fail-safe: qualquer falha vira revisão humana — NUNCA aprova no erro e
// NUNCA deixa o anúncio preso (segue para pending_review).
function reviewFallback(reason: string, error?: string): ModerationResult {
  return {
    imageApproved: false,
    moderationFlagged: false,
    moderationCategories: {},
    needsManualReview: true,
    moderationReason: reason,
    reason,
    error,
  };
}

serve(async (req) => {
  // CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // JWT Authentication (fluxo síncrono — mantido)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Rate limiting per user
    const ratelimit = createRateLimiter();
    if (ratelimit) {
      try {
        const { success, remaining } = await ratelimit.limit(user.id);
        if (!success) {
          console.log("[moderate-image] Rate limit exceeded for user:", user.id);
          return new Response(
            JSON.stringify({ error: "Muitas requisições. Aguarde antes de tentar novamente." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Remaining": remaining.toString(),
                ...corsHeaders,
              },
            },
          );
        }
      } catch (rateLimitError) {
        console.error("[moderate-image] Rate limit check failed:", rateLimitError);
      }
    }

    const { imageUrl, imageBase64 } = await req.json();

    // Aceita base64-only (moderação pré-upload, p/ privacidade) OU imageUrl.
    const hasValidInlineImage =
      typeof imageBase64 === "string" &&
      /^data:image\/(jpeg|jpg|png|webp);base64,/.test(imageBase64) &&
      imageBase64.length <= MAX_INLINE_IMAGE_CHARS;
    const hasImageUrl = typeof imageUrl === "string" && imageUrl.length > 0;

    if (!hasValidInlineImage && !hasImageUrl) {
      console.error("[moderate-image] No image provided (need imageBase64 or imageUrl)");
      return json(reviewFallback("Imagem não fornecida"), 400);
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[moderate-image] OPENAI_API_KEY not configured");
      return json(reviewFallback("Serviço de moderação não configurado."));
    }

    // Prefere a data URL reduzida do cliente; senão usa a URL pública do Storage.
    const imageInput: string = hasValidInlineImage ? imageBase64 : imageUrl;

    console.log(
      "[moderate-image] Moderating image via OpenAI:",
      hasValidInlineImage ? "inline data URL" : imageUrl.substring(0, 100) + "...",
    );

    // Chamada à OpenAI Moderation API com retry/backoff (429/5xx) + AbortController.
    let response: Response | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
      try {
        console.log(`[moderate-image] Attempt ${attempt}/${MAX_RETRIES}`);
        response = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "omni-moderation-latest",
            input: [{ type: "image_url", image_url: { url: imageInput } }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) break;

        lastError = `HTTP ${response.status}: ${await response.text()}`;
        console.error(`[moderate-image] OpenAI error (attempt ${attempt}):`, lastError);

        // Retry só em 429/5xx; 4xx (exceto 429) não adianta retentar.
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[moderate-image] Retrying in ${waitTime}ms`);
          await sleep(waitTime);
          continue;
        }
        break;
      } catch (fetchError) {
        clearTimeout(timeout);
        // Inclui AbortError (timeout do AbortController).
        lastError = String(fetchError);
        console.error(`[moderate-image] Fetch error (attempt ${attempt}):`, lastError);
        if (attempt < MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    if (!response || !response.ok) {
      console.warn("[moderate-image] OpenAI unavailable — sending to manual review:", lastError);
      return json(
        reviewFallback(
          "Verificação automática indisponível. Revisão manual necessária.",
          lastError ?? undefined,
        ),
      );
    }

    let data: OpenAIModerationResponse;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("[moderate-image] Failed to read OpenAI response body:", parseError);
      return json(
        reviewFallback("Resposta da moderação ilegível. Revisão manual necessária.", String(parseError)),
      );
    }

    // Decisão pelos category_scores + flags por categoria da OpenAI
    // (parse defensivo: formato inesperado -> revisão).
    const scores = parseCategoryScores(data);
    const categories = data?.results?.[0]?.categories;
    const verdict = evaluateImageModeration(scores, categories);

    // Categoria dominante (maior score) — alimenta a régua do modal no client.
    const top = dominantCategory(verdict.scores);
    const confidenceScore = top.score;

    // Map de categorias que cruzaram o limiar (informativo; o cliente só usa no
    // ramo de hard-reject, que não acontece aqui pois moderationFlagged=false).
    const moderationCategories: Record<string, boolean> = {};
    for (const [cat, s] of Object.entries(verdict.scores)) {
      const threshold = cat === SEXUAL_CATEGORY ? SEXUAL_REVIEW_THRESHOLD : SAFETY_REVIEW_THRESHOLD;
      moderationCategories[cat] = s >= threshold;
    }

    console.log("[moderate-image] Result:", {
      needsManualReview: verdict.needsManualReview,
      confidenceScore,
      category: top.category,
      scores: verdict.scores,
    });

    const result: ModerationResult = verdict.needsManualReview
      ? {
        imageApproved: false,
        moderationFlagged: false,
        moderationCategories,
        needsManualReview: true,
        moderationReason: verdict.reason,
        reason: verdict.reason,
        confidenceScore,
        categoryScores: verdict.scores,
        category: top.category,
      }
      : {
        imageApproved: true,
        moderationFlagged: false,
        moderationCategories,
        needsManualReview: false,
        confidenceScore,
        categoryScores: verdict.scores,
        category: top.category,
      };

    return json(result);
  } catch (error) {
    console.error("[moderate-image] Unexpected error:", error);
    // Erro inesperado também vai para revisão — nunca aprova no erro.
    return json(
      reviewFallback("Erro inesperado ao verificar imagem. Revisão manual necessária.", String(error)),
      500,
    );
  }
});
