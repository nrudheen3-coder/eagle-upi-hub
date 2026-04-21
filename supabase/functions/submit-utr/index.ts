// Public endpoint: customer submits UTR for a pending invoice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoice_id, utr } = await req.json();
    if (!invoice_id || !utr) return json({ error: "invoice_id and utr required" }, 400);

    const cleanUtr = String(utr).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6,30}$/.test(cleanUtr)) {
      return json({ error: "invalid UTR format" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get invoice
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, status, merchant_id, amount, expires_at")
      .eq("invoice_id", invoice_id)
      .single();

    if (!existing) return json({ error: "invoice not found" }, 404);
    if (existing.status === "verified") return json({ success: true, already_verified: true });
    if (existing.status === "expired" || existing.status === "failed") {
      return json({ error: "invoice expired or failed" }, 400);
    }

    // Fix 3: check actual expires_at timestamp, not just status
    if (new Date(existing.expires_at) < new Date()) {
      // Mark as expired in DB for future checks
      await supabase
        .from("transactions")
        .update({ status: "expired" })
        .eq("id", existing.id);
      return json({ error: "invoice has expired" }, 400);
    }

    // Fix 4: block duplicate UTR
    const { data: dupCheck } = await supabase
      .from("transactions")
      .select("id, invoice_id")
      .eq("utr", cleanUtr)
      .eq("status", "verified")
      .limit(1);
    if (dupCheck && dupCheck.length > 0) {
      return json({ error: "UTR already used for another payment" }, 400);
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        utr: cleanUtr,
        status: "submitted",
        matched_via: "manual_utr",
        matched_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .in("status", ["pending_payment", "pending_utr"]);

    if (error) {
      console.error(error);
      return json({ error: "failed to submit" }, 500);
    }

    // Fix 6 + 9: webhook with retry (up to 3 attempts) and HMAC signature
    fireWebhookWithRetry(supabase, existing.merchant_id, invoice_id, cleanUtr).catch(console.error);

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "invalid request" }, 400);
  }
});

async function fireWebhookWithRetry(
  supabase: ReturnType<typeof createClient>,
  merchantId: string,
  invoiceId: string,
  utr: string,
  attempts = 3,
) {
  const { data: m } = await supabase
    .from("merchants")
    .select("webhook_url")
    .eq("id", merchantId)
    .single();
  if (!m?.webhook_url) return;
  if (!isSafeWebhookUrl(m.webhook_url)) {
    console.warn("blocked unsafe webhook url", m.webhook_url);
    return;
  }

  const payload = JSON.stringify({
    event: "payment.utr_submitted",
    invoice_id: invoiceId,
    utr,
    timestamp: new Date().toISOString(),
  });
  const sig = await hmacSign(Deno.env.get("WEBHOOK_SECRET") ?? "default_secret", payload);

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(m.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EaglePay-Signature": sig,
        },
        body: payload,
      });
      if (res.ok) return; // success
      console.warn(`[submit-utr] webhook attempt ${i + 1} failed: ${res.status}`);
    } catch (e) {
      console.warn(`[submit-utr] webhook attempt ${i + 1} error:`, e);
    }
    // Exponential backoff: 1s, 2s, 4s
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
  }
  console.error(`[submit-utr] webhook failed after ${attempts} attempts for invoice ${invoiceId}`);
}

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
