import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  combineTextVerdict,
  evaluateField,
  parseCategoryScoresAt,
} from "./moderation.ts";
import type { OpenAIModerationResponse, TextModerationResult } from "./types.ts";

// Rate limiting: 20 requests per minute per user
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");

  if (!redisUrl || !redisToken) {
    console.warn("[moderate-text] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:moderate-text",
  });
}

// Timeout por tentativa de chamada à OpenAI (via AbortController).
const OPENAI_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fail-safe: qualquer falha vira revisão humana — NUNCA aprova no erro e
// NUNCA deixa o anúncio preso (segue para pending_review).
function reviewFallback(reason: string, error?: string): TextModerationResult {
  return {
    textApproved: false,
    moderationFlagged: false,
    moderationCategories: {},
    needsManualReview: true,
    moderationReason: reason,
    confidenceScore: 0,
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
    // JWT Authentication
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
          console.log("[moderate-text] Rate limit exceeded for user:", user.id);
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
        console.error("[moderate-text] Rate limit check failed:", rateLimitError);
      }
    }

    const { title, description } = await req.json();

    if (!title || typeof title !== "string") {
      console.error("[moderate-text] Missing or invalid title");
      return json(reviewFallback("Título não fornecido"), 400);
    }

    const descriptionText = typeof description === "string" ? description.trim() : "";
    const hasDescription = descriptionText.length > 0;

    console.log("[moderate-text] Moderating text via OpenAI:", {
      titleLength: title.length,
      descriptionLength: descriptionText.length,
    });

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("[moderate-text] OPENAI_API_KEY not configured");
      return json(reviewFallback("Serviço de moderação não configurado."));
    }

    // input como array de STRINGS: a OpenAI devolve um `result` por string
    // (results[0]=título, results[1]=descrição). ATENÇÃO: um array de objetos
    // content-part (`{type:"text",...}`) seria tratado como UM input multimodal
    // combinado, retornando só results[0] — o que mandava todo anúncio com
    // descrição para revisão (results[1] = undefined -> fail-safe).
    const input: string[] = [title];
    if (hasDescription) input.push(descriptionText);

    // Chamada à OpenAI Moderation API com retry/backoff (429/5xx) + AbortController.
    let response: Response | null = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
      try {
        console.log(`[moderate-text] Attempt ${attempt}/${MAX_RETRIES}`);
        response = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({ model: "omni-moderation-latest", input }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) break;

        lastError = `HTTP ${response.status}: ${await response.text()}`;
        console.error(`[moderate-text] OpenAI error (attempt ${attempt}):`, lastError);

        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[moderate-text] Retrying in ${waitTime}ms`);
          await sleep(waitTime);
          continue;
        }
        break;
      } catch (fetchError) {
        clearTimeout(timeout);
        lastError = String(fetchError); // inclui AbortError (timeout)
        console.error(`[moderate-text] Fetch error (attempt ${attempt}):`, lastError);
        if (attempt < MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    if (!response || !response.ok) {
      console.warn("[moderate-text] OpenAI unavailable — sending to manual review:", lastError);
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
      console.error("[moderate-text] Failed to read OpenAI response body:", parseError);
      return json(
        reviewFallback("Resposta da moderação ilegível. Revisão manual necessária.", String(parseError)),
      );
    }

    // Decisão por scores, por campo (parse defensivo: formato inesperado -> revisão).
    const titleDecision = evaluateField(parseCategoryScoresAt(data, 0));
    const descriptionDecision = hasDescription
      ? evaluateField(parseCategoryScoresAt(data, 1))
      : null;
    const verdict = combineTextVerdict(titleDecision, descriptionDecision);

    console.log("[moderate-text] Result:", {
      moderationFlagged: verdict.moderationFlagged,
      flaggedField: verdict.flaggedField,
      needsManualReview: verdict.needsManualReview,
      confidenceScore: verdict.confidenceScore,
    });

    const result: TextModerationResult = {
      textApproved: !verdict.moderationFlagged && !verdict.needsManualReview,
      moderationFlagged: verdict.moderationFlagged,
      moderationCategories: {},
      flaggedField: verdict.moderationFlagged ? verdict.flaggedField : undefined,
      needsManualReview: verdict.needsManualReview,
      moderationReason: verdict.reason,
      confidenceScore: verdict.confidenceScore,
    };

    return json(result);
  } catch (error) {
    console.error("[moderate-text] Unexpected error:", error);
    // Erro inesperado também vai para revisão — nunca aprova no erro.
    return json(
      reviewFallback("Erro inesperado ao verificar texto. Revisão manual necessária.", String(error)),
      500,
    );
  }
});
