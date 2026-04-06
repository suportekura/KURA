import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: 'title' | 'description' | 'both';
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}

// Confidence thresholds
const LOW_CONFIDENCE_THRESHOLD = 0.7;

const MODERATION_PROMPT = `You are a content moderation system for a Brazilian second-hand clothing and accessories marketplace (brechó online). Your job is to evaluate whether a product listing contains genuinely harmful content — NOT to flag normal clothing vocabulary.

## CRITICAL: Evaluate words in context, not in isolation

Words must be judged by their meaning in the full sentence, not by whether they could theoretically be offensive in a different context. This is a clothing marketplace — words describe products.

## ALWAYS ALLOWED in this marketplace context

Color names describing clothing — these are NEVER hate speech:
- "preta", "preto" = black (color of the garment)
- "branca", "branco" = white (color of the garment)
- "amarela", "amarelo" = yellow (color of the garment)
- "vermelha", "vermelho" = red, etc.
Examples: "Camisa preta tamanho M", "Vestido branco de festa", "Camiseta amarela" — ALL APPROVED.

Normal product attributes:
- Sizes: PP, P, M, G, GG, XG, 36, 38, 40, 42...
- Conditions: novo, usado, ótimo estado, com desgaste
- Fabric: algodão, poliéster, lycra, jeans, couro, linho
- Brand names, style names, model names
- Fashion terms: vintage, oversized, cropped, slim, flare
- Body descriptions in context of fit: "veste bem em corpos maiores", "caimento reto"
- Portuguese product descriptions, including slang for clothing (camisão, calçola, etc.)

## Categories to flag (only when clearly present in context)

- sexual: Explicitly sexual language or intent — NOT body-neutral sizing descriptions
- sexual/minors: Any sexualization of minors
- violence: Actual threats or glorification of violence — NOT "killer style" fashion expressions
- violence/graphic: Graphic violent content
- self-harm: Content that promotes self-harm
- self-harm/intent / self-harm/instructions: Instructions or encouragement for self-harm
- illicit: Clear references to illegal items (drugs, weapons) being sold — NOT fashion references
- illicit/violent: Violent illegal activities
- hate: Language that attacks a person or group based on race, religion, gender, etc. — only flag when the word is used as a slur or attack, NOT when it describes a product color or neutral attribute
- hate/threatening: Threatening hate content
- spam: Listings with no relation to clothing (e.g. "vendo iPhone", "clique aqui para ganhar"), keyword stuffing, or completely misleading descriptions
- profanity: Gratuitous offensive language with no product context — NOT casual Brazilian Portuguese expressions

## Decision rule

Ask yourself: "Does this text, read as a whole, describe a clothing/accessory product in a normal way?" If yes → flagged: false. Only flag content that would be harmful or deceptive regardless of the clothing context.

Respond ONLY with a valid JSON object in this exact format:
{
  "flagged": true or false,
  "confidence": 0.0 to 1.0,
  "flaggedField": "title" or "description" or "both" or null,
  "categories": {
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
    "hate/threatening": true or false,
    "spam": true or false,
    "profanity": true or false
  }
}

The "confidence" field reflects certainty about your flagging decision:
- 1.0 = absolutely certain content is harmful
- 0.7-0.99 = confident it is harmful
- 0.5-0.69 = uncertain — could be harmful
- below 0.5 = very uncertain

Set "flagged" to true ONLY if a category is clearly present. When in doubt about normal clothing vocabulary, set flagged: false.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();

    if (!title || typeof title !== 'string') {
      console.error('[moderate-text] Missing or invalid title');
      return new Response(
        JSON.stringify({
          textApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Título não fornecido',
        } as TextModerationResult),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[moderate-text] Moderating text:', { 
      titleLength: title.length, 
      descriptionLength: description?.length || 0 
    });

    const googleAiApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (!googleAiApiKey) {
      console.error('[moderate-text] GOOGLE_AI_API_KEY not configured');
      return new Response(
        JSON.stringify({
          textApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Serviço de moderação não configurado',
        } as TextModerationResult),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const textToModerate = `TITLE: ${title}\n\nDESCRIPTION: ${description || 'No description provided'}`;

    // Call Google AI API with retry logic
    const maxRetries = 3;
    let lastError: string | null = null;
    let moderationResponse: Response | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[moderate-text] Attempt ${attempt}/${maxRetries}`);
        
        moderationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleAiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${MODERATION_PROMPT}\n\n---\n\n${textToModerate}` }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 500 },
          }),
        });

        if (moderationResponse.ok) {
          break;
        }

        const errorText = await moderationResponse.text();
        console.error(`[moderate-text] API error (attempt ${attempt}):`, moderationResponse.status, errorText);
        lastError = errorText;

        if (moderationResponse.status === 429 && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[moderate-text] Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (moderationResponse.status !== 429) {
          break;
        }
      } catch (fetchError) {
        console.error(`[moderate-text] Fetch error (attempt ${attempt}):`, fetchError);
        lastError = String(fetchError);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!moderationResponse || !moderationResponse.ok) {
      console.warn('[moderate-text] AI unavailable — auto-approving:', lastError);

      return new Response(
        JSON.stringify({
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        } as TextModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const responseData = await moderationResponse.json();
    console.log('[moderate-text] Google AI response:', JSON.stringify(responseData));

    const content = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('[moderate-text] No content in response');
      return new Response(
        JSON.stringify({
          textApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: 'Resposta inválida do serviço de moderação',
        } as TextModerationResult),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the JSON response from the AI
    let moderationData: { flagged: boolean; confidence?: number; flaggedField?: string; categories: Record<string, boolean> };
    try {
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
      console.error('[moderate-text] Failed to parse AI response:', content);
      // If we can't parse, mark for manual review
      return new Response(
        JSON.stringify({
          textApproved: false,
          moderationFlagged: false,
          moderationCategories: {},
          confidenceScore: 0,
          needsManualReview: true,
          moderationReason: 'Não foi possível interpretar a resposta do serviço de moderação. Revisão manual necessária.',
        } as TextModerationResult),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const flagged = moderationData.flagged === true;
    const confidence = typeof moderationData.confidence === 'number' ? moderationData.confidence : 1.0;
    const categories = moderationData.categories || {};
    const flaggedField = moderationData.flaggedField as 'title' | 'description' | 'both' | undefined;

    // Manual review only when AI suspects a violation but isn't confident enough to hard-block.
    // If flagged=false (AI says safe), always approve regardless of confidence level —
    // "uncertain but safe" is still safe. Gray area = AI thinks it MIGHT be bad, not AI unsure of safe content.
    const needsManualReview = flagged && confidence < LOW_CONFIDENCE_THRESHOLD;

    // Text is approved only if NOT flagged AND confidence is high enough
    const textApproved = !flagged && !needsManualReview;

    // Generate human-readable reason when AI suspects a violation but isn't confident
    const moderationReason = needsManualReview
      ? `Possível violação detectada com confiança baixa (${Math.round(confidence * 100)}%). Revisão humana necessária para confirmar.`
      : undefined;

    console.log('[moderate-text] Result:', { 
      textApproved, 
      flagged, 
      confidence,
      needsManualReview,
      flaggedField,
      categories 
    });

    return new Response(
      JSON.stringify({
        textApproved,
        moderationFlagged: flagged,
        moderationCategories: categories,
        flaggedField: flagged ? flaggedField : undefined,
        confidenceScore: confidence,
        needsManualReview,
        moderationReason,
      } as TextModerationResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[moderate-text] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        textApproved: false,
        moderationFlagged: true,
        moderationCategories: {},
        error: 'Erro inesperado ao verificar texto',
      } as TextModerationResult),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
