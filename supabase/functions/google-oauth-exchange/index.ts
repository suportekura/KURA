import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const ALLOWED_REDIRECT_URIS = [
  "https://kuralab.com.br/auth/callback",
  "http://localhost:8080/auth/callback",
];

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { code, redirect_uri } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!redirect_uri || !ALLOWED_REDIRECT_URIS.includes(redirect_uri)) {
      return new Response(JSON.stringify({ error: "Invalid redirect_uri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_AUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_AUTH_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      console.error("Google token exchange error:", tokenData);
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error || "Token exchange failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { id_token, access_token } = tokenData;

    if (!id_token) {
      return new Response(JSON.stringify({ error: "No id_token in response" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id_token, access_token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
