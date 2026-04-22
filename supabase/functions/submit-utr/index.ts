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

    // Check if UTR was already auto-matched by listener
    const { data: existing } = await supabase
      .from("transactions")
      .select("status, merchant_id")
      .eq("invoice_id", invoice_id)
      .single();

    if (!existing) return json({ error: "invoice not found" }, 404);
    if (existing.status === "verified") {
      return json({ success: true, already_verified: true });
    }
    if (existing.status === "expired") {
      return json({ error: "invoice expired" }, 400);
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        utr: cleanUtr,
        status: "submitted",
        matched_via: "manual_utr",
        matched_at: new Date().toISOString(),
      })
      .eq("invoice_id", invoice_id)
      .in("status", ["pending_payment", "pending_utr"]);

    if (error) {
      console.error(error);
      return json({ error: "failed to submit" }, 500);
    }

    // Fire merchant webhook (best-effort, non-blocking)
    fireWebhook(supabase, existing.merchant_id, invoice_id, cleanUtr).catch(console.error);

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "invalid request" }, 400);
  }
});

async function fireWebhook(supabase: ReturnType<typeof createClient>, merchantId: string, invoiceId: string, utr: string) {
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
  try {
    await fetch(m.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "payment.utr_submitted",
        invoice_id: invoiceId,
        utr,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("webhook fail", e);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// SSRF guard: only allow https public hosts; block localhost, private/link-local IPs.
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
