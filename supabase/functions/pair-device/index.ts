// Authenticated endpoint: merchant creates a new listener device and gets back its token.
// Auth: standard Supabase JWT (Authorization: Bearer ...)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing auth" }, 401);

    // Fix: use service role client + getUser(token) — works with both HS256 and ES256 JWTs.
    // The old approach used SUPABASE_PUBLISHABLE_KEY which doesn't support ES256 verification.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "invalid session" }, 401);

    const { device_name } = await req.json();
    const name = (device_name && String(device_name).slice(0, 50)) || "My Phone";

    const { data: merchant } = await supabase
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!merchant) return json({ error: "merchant not found" }, 404);

    const { data: device, error } = await supabase
      .from("listener_devices")
      .insert({ merchant_id: merchant.id, device_name: name })
      .select("id, device_token, device_name, created_at")
      .single();
    if (error || !device) return json({ error: "could not create device" }, 500);

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notification-webhook`;

    return json({
      device_id: device.id,
      device_token: device.device_token,
      device_name: device.device_name,
      webhook_url: webhookUrl,
      // Pairing payload that the Android app can consume via QR
      pairing_payload: JSON.stringify({
        v: 1,
        token: device.device_token,
        webhook: webhookUrl,
        name: device.device_name,
      }),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "invalid request" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
