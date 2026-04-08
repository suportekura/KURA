import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.0.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Rate limiting: 20 requests per minute per user
function createRateLimiter() {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_URL");
  const redisToken = Deno.env.get("UPSTASH_REDIS_TOKEN");

  if (!redisUrl || !redisToken) {
    console.warn("[moderate-image] Rate limiting not configured - UPSTASH credentials missing");
    return null;
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:moderate-image",
  });
}

interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}

// Safety categories: always block regardless of confidence score
const SAFETY_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'illicit',
  'illicit/violent',
  'hate',
  'hate/threatening',
];

// Quality categories: only block when Gemini is highly confident (>= 0.85)
// This prevents false positives on legitimate product photos (e.g. clothing worn on body)
const QUALITY_CATEGORIES = [
  'screenshot',
  'heavily_edited',
  'not_product',
  'low_quality',
];

// Quality categories require high confidence to block — avoids false positives
const QUALITY_CONFIDENCE_THRESHOLD = 0.85;
// Manual review threshold for uncertain cases
const LOW_CONFIDENCE_THRESHOLD = 0.5;

const MODERATION_PROMPT = `You are a content moderation system for a marketplace that ONLY sells clothing and accessories. Analyze this image carefully.

## ALLOWED CONTENT (set flagged=false):
Real photographs of:
- Clothing items: t-shirts, shirts, pants, shorts, dresses, skirts, jackets, coats, sweaters, hoodies, underwear, swimwear, activewear
- Footwear: shoes, sneakers, boots, sandals, slippers
- Accessories: bags, purses, wallets, belts, hats, caps, scarves, jewelry, watches, sunglasses, glasses
- Clothing WORN on a person: full body, partial body, with or without face visible — this is normal and expected in a secondhand clothing marketplace
- Photos where body parts are visible (neck, arms, legs, hands, feet) as long as a clothing or accessory item is present
- Selfies or mirror photos where the person is wearing the item being sold

## BLOCKED CONTENT (set flagged=true):

### Category: screenshot
- Screenshots of apps, websites, or any digital interface
- Screen captures from phones, computers, or tablets
- Images showing phone/computer UI elements, status bars, app icons

### Category: heavily_edited
- Heavily photoshopped or manipulated images
- Images with excessive filters that distort the product
- Collages or composite images
- Images with text overlays, watermarks, or promotional graphics
- AI-generated or artificial-looking product images

### Category: not_product
- Images where NO clothing or accessory item is visible at all
- Pure portraits or selfies with no product present in the frame
- Random objects with no clothing: electronics, furniture, food, vehicles, etc.
- NOTE: photos of people WEARING clothing are NOT not_product — they are valid product photos

### Category: low_quality
- Blurry or out-of-focus images where product details are not visible
- Very dark or overexposed images
- Images where the product is barely visible or too small

### Safety categories (also block):
- sexual: Sexual content or nudity
- sexual/minors: Sexual content involving minors  
- violence: Violent content
- violence/graphic: Graphic violence
- self-harm: Content depicting self-harm
- self-harm/intent: Content encouraging self-harm
- self-harm/instructions: Instructions for self-harm
- illicit: Illegal activities
- illicit/violent: Violent illegal activities
- hate: Hateful content
- hate/threatening: Threatening hateful content

Respond ONLY with a valid JSON object in this exact format:
{
  "flagged": true or false,
  "confidence": 0.0 to 1.0,
  "categories": {
    "screenshot": true or false,
    "heavily_edited": true or false,
    "not_product": true or false,
    "low_quality": true or false,
    "sexual": true or false,
    "sexual/minors": true or false,
    "violence": true or false,
    "violence/graphic": true or false,
    "self-harm": true or false,
    "self-harm/intent": true or false,
    "self-harm/instructions": true or false,
    "illicit": true or false,
    "illicit/violent": true or false,
    "hate": true or false,
    "hate/threatening": true or false
  },
  "reason": "Brief explanation if flagged"
}

The "confidence" field should indicate how certain you are about your assessment:
- 1.0 = absolutely certain
- 0.7-0.99 = confident
- 0.5-0.69 = uncertain, may need human review
- below 0.5 = very uncertain

Set "flagged" to true if ANY category is true. Be strict - only allow clear, real photos of clothing items and accessories.`;

serve(async (req) => {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // JWT Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
            }
          );
        }
      } catch (rateLimitError) {
        console.error("[moderate-image] Rate limit check failed:", rateLimitError);
      }
    }

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('[moderate-image] Missing or invalid imageUrl');
      return new Response(
        JSON.stringify({
          imageApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'URL da imagem não fornecida',
        } as ModerationResult),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[moderate-image] Moderating image:', imageUrl.substring(0, 100) + '...');

    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!googleAiApiKey) {
      console.error('[moderate-image] GOOGLE_AI_API_KEY not configured');
      return new Response(
        JSON.stringify({
          imageApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Serviço de moderação não configurado',
        } as ModerationResult),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch the image and convert to base64 — Gemini cannot fetch external URLs directly
    let imageDataUri: string;
    try {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error(`Image fetch failed: ${imgResponse.status}`);
      const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const buffer = await imgResponse.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      imageDataUri = `data:${mimeType};base64,${base64}`;
      console.log('[moderate-image] Image downloaded, size:', uint8.length, 'bytes');
    } catch (fetchErr) {
      console.error('[moderate-image] Failed to download image:', fetchErr);
      return new Response(
        JSON.stringify({
          imageApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Não foi possível carregar a imagem para moderação',
        } as ModerationResult),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Google AI API with retry logic
    const maxRetries = 3;
    let lastError: string | null = null;
    let moderationResponse: Response | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[moderate-image] Attempt ${attempt}/${maxRetries}`);

        const [dataUriHeader, base64Data] = imageDataUri.split(',');
        const imageMimeType = dataUriHeader.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

        moderationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleAiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: MODERATION_PROMPT },
                { inline_data: { mime_type: imageMimeType, data: base64Data } },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 2000 },
          }),
        });

        if (moderationResponse.ok) {
          break; // Success, exit retry loop
        }

        const errorText = await moderationResponse.text();
        console.error(`[moderate-image] API error (attempt ${attempt}):`, moderationResponse.status, errorText);
        lastError = errorText;

        // If rate limited (429), wait and retry
        if (moderationResponse.status === 429 && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[moderate-image] Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // For other errors, don't retry
        if (moderationResponse.status !== 429) {
          break;
        }
      } catch (fetchError) {
        console.error(`[moderate-image] Fetch error (attempt ${attempt}):`, fetchError);
        lastError = String(fetchError);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-image] AI unavailable — auto-approving:', lastError);

      return new Response(
        JSON.stringify({
          imageApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        } as ModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const responseData = await moderationResponse.json();
    console.log('[moderate-image] Google AI response:', JSON.stringify(responseData));

    // Extract the content from the response
    const content = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('[moderate-image] No content in response');
      return new Response(
        JSON.stringify({
          imageApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Resposta inválida do serviço de moderação',
        } as ModerationResult),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the JSON response from the AI
    let moderationData: { flagged: boolean; confidence?: number; categories: Record<string, boolean>; reason?: string };
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      moderationData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[moderate-image] Failed to parse AI response:', content);
      // If we can't parse, mark for manual review
      return new Response(
        JSON.stringify({
          imageApproved: false,
          moderationFlagged: false,
          moderationCategories: {},
          confidenceScore: 0,
          needsManualReview: true,
          moderationReason: 'Não foi possível interpretar a resposta do serviço de moderação. Revisão manual necessária.',
        } as ModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const flagged = moderationData.flagged === true;
    const confidence = typeof moderationData.confidence === 'number' ? moderationData.confidence : 1.0;
    const categories = moderationData.categories || {};

    // Safety categories: block regardless of confidence (explicit nudity, violence, etc.)
    let hasSafetyViolation = false;
    for (const category of SAFETY_CATEGORIES) {
      if (categories[category] === true) {
        hasSafetyViolation = true;
        console.log('[moderate-image] Safety category detected:', category);
        break;
      }
    }

    // Quality categories: only block when Gemini is highly confident (>= 0.85)
    // This prevents false positives on legitimate product photos worn on body
    let hasQualityViolation = false;
    if (confidence >= QUALITY_CONFIDENCE_THRESHOLD) {
      for (const category of QUALITY_CATEGORIES) {
        if (categories[category] === true) {
          hasQualityViolation = true;
          console.log('[moderate-image] Quality category detected (high confidence):', category);
          break;
        }
      }
    }

    const hasBlockingCategory = hasSafetyViolation || hasQualityViolation;

    // Manual review only when AI flagged something but isn't confident enough to hard-block.
    // If flagged=false (no issues detected), approve directly — low overall confidence on safe content is normal.
    const needsManualReview = flagged && !hasBlockingCategory && confidence < LOW_CONFIDENCE_THRESHOLD;

    // Generate reason only when AI suspects a violation but isn't confident enough to block
    const moderationReason = needsManualReview
      ? `Possível problema detectado com confiança de ${Math.round(confidence * 100)}%.${moderationData.reason ? ` Motivo: ${moderationData.reason}` : ' Revisão humana necessária.'}`
      : undefined;

    // Image is approved if no safety violation, no high-confidence quality violation, and not uncertain
    const imageApproved = !flagged && !hasBlockingCategory && !needsManualReview;

    console.log('[moderate-image] Result:', { 
      imageApproved, 
      flagged, 
      hasBlockingCategory,
      confidence,
      needsManualReview,
      categories 
    });

    return new Response(
      JSON.stringify({
        imageApproved,
        moderationFlagged: flagged || hasBlockingCategory,
        moderationCategories: categories,
        confidenceScore: confidence,
        needsManualReview,
        moderationReason,
      } as ModerationResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[moderate-image] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        imageApproved: false,
        moderationFlagged: true,
        moderationCategories: {},
        error: 'Erro inesperado ao verificar imagem',
      } as ModerationResult),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});