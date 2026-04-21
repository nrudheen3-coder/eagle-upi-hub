// Authenticated endpoint: merchant manually approves or rejects a submitted UTR.
// Auth: standard Supabase JWT (Authorization: Bearer ...)
// Body: { invoice_id, action: "approve" | "reject" }
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify JWT - works with ES256 and HS256
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "invalid session" }, 401);

    const { invoice_id, action } = await req.json();
    if (!invoice_id || !["approve", "reject"].includes(action)) {
      return json({ error: "invoice_id and action (approve|reject) required" }, 400);
    }

    // Get merchant
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, webhook_url")
      .eq("user_id", user.id)
      .single();
    if (!merchant) return json({ error: "merchant not found" }, 404);

    // Get transaction — must belong to this merchant and be in submitted status
    const { data: txn } = await supabase
      .from("transactions")
      .select("id, invoice_id, amount, utr, status, payer_vpa")
      .eq("invoice_id", invoice_id)
      .eq("merchant_id", merchant.id)
      .single();

    if (!txn) return json({ error: "invoice not found" }, 404);
    if (txn.status !== "submitted") {
      return json({ error: `cannot ${action} invoice with status: ${txn.status}` }, 400);
    }

    const newStatus = action === "approve" ? "verified" : "failed";

    const { error: upErr } = await supabase
      .from("transactions")
      .update({
        status: newStatus,
        matched_via: "manual_approval",
        matched_at: new Date().toISOString(),
      })
      .eq("id", txn.id);

    if (upErr) return json({ error: "failed to update transaction" }, 500);

    // Fire merchant webhook on approve
    if (action === "approve" && merchant.webhook_url && isSafeWebhookUrl(merchant.webhook_url)) {
      fetch(merchant.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EaglePay-Signature": await hmacSign(
            Deno.env.get("WEBHOOK_SECRET") ?? "default_secret",
            JSON.stringify({ event: "payment.verified", invoice_id })
          ),
        },
        body: JSON.stringify({
          event: "payment.verified",
          invoice_id: txn.invoice_id,
          amount: txn.amount,
          utr: txn.utr,
          source: "manual_approval",
          payer_vpa: txn.payer_vpa,
          timestamp: new Date().toISOString(),
        }),
      }).catch(console.error);
    }

    console.log(`[verify-utr] invoice=${invoice_id} action=${action} merchant=${merchant.id}`);
    return json({ success: true, status: newStatus });

  } catch (e) {
    console.error(e);
    return json({ error: "invalid request" }, 400);
  }
});

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" || host.endsWith(".localhost") ||
    host === "0.0.0.0" || host === "::1" || host === "[::1]" ||
    /^127\./.test(host) || /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^fc[0-9a-f]{2}:/i.test(host) ||
    /^fe80:/i.test(host) ||
    host.endsWith(".internal") || host.endsWith(".local")
  ) return false;
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
