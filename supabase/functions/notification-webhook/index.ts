// Receives parsed UPI notifications from the Android Notification Listener app.
// Auth: device_token in X-Device-Token header (issued via pair-device).
// Body: { amount, utr, raw_text, source, payer_vpa? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const deviceToken = req.headers.get("x-device-token");
  if (!deviceToken) return json({ error: "missing X-Device-Token" }, 401);

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const utr = body.utr ? String(body.utr).replace(/\s+/g, "").toUpperCase() : null;
    const rawText = body.raw_text ? String(body.raw_text).slice(0, 1000) : null;
    const source = body.source ? String(body.source).slice(0, 50) : "unknown";
    const payerVpa = body.payer_vpa ? String(body.payer_vpa).slice(0, 100) : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "invalid amount" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth device + get merchant
    const { data: device, error: devErr } = await supabase
      .from("listener_devices")
      .select("id, merchant_id")
      .eq("device_token", deviceToken)
      .single();

    if (devErr || !device) return json({ error: "invalid device token" }, 401);

    // Update heartbeat
    await supabase
      .from("listener_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    // Get merchant match window
    const { data: merchant } = await supabase
      .from("merchants")
      .select("match_window_minutes, webhook_url")
      .eq("id", device.merchant_id)
      .single();

    const windowMin = merchant?.match_window_minutes ?? 5;

    // Find a pending invoice with matching amount in the window
    const cutoff = new Date(Date.now() - windowMin * 60 * 1000).toISOString();

    const { data: pending } = await supabase
      .from("transactions")
      .select("id, invoice_id, amount")
      .eq("merchant_id", device.merchant_id)
      .eq("amount", amount)
      .in("status", ["pending_payment", "pending_utr", "submitted"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    let matched = false;
    let matchedInvoiceId: string | null = null;

    if (pending && pending.length > 0) {
      const tx = pending[0];
      const { error: upErr } = await supabase
        .from("transactions")
        .update({
          status: "verified",
          utr: utr || `LISTENER_${Date.now()}`,
          payer_vpa: payerVpa,
          matched_via: "notification_listener",
          matched_at: new Date().toISOString(),
        })
        .eq("id", tx.id);

      if (!upErr) {
        matched = true;
        matchedInvoiceId = tx.invoice_id;

        // Fire merchant webhook
        if (merchant?.webhook_url && isSafeWebhookUrl(merchant.webhook_url)) {
          fetch(merchant.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "payment.verified",
              invoice_id: tx.invoice_id,
              amount,
              utr,
              source,
              payer_vpa: payerVpa,
              timestamp: new Date().toISOString(),
            }),
          }).catch(console.error);
        } else if (merchant?.webhook_url) {
          console.warn("blocked unsafe webhook url", merchant.webhook_url);
        }
      }
    }

    console.log(`[notification-webhook] amount=${amount} utr=${utr} source=${source} matched=${matched} invoice=${matchedInvoiceId}`);

    return json({
      received: true,
      matched,
      invoice_id: matchedInvoiceId,
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
