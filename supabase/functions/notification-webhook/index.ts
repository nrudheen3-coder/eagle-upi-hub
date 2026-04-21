// Receives parsed UPI notifications from the Android Notification Listener app.
// Auth: device_token in X-Device-Token header (issued via pair-device).
// Body: { amount, utr, raw_text, source, payer_vpa?, captured_at? }
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

    // Skip heartbeat pings early — no DB match needed
    if (source === "heartbeat" || amount === 0) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: device } = await supabase
        .from("listener_devices")
        .select("id")
        .eq("device_token", deviceToken)
        .single();
      if (!device) return json({ error: "invalid device token" }, 401);
      await supabase
        .from("listener_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", device.id);
      return json({ received: true, matched: false });
    }

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
    const cutoff = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Fix 2: only match non-expired invoices (check both created_at window AND expires_at)
    const { data: pending } = await supabase
      .from("transactions")
      .select("id, invoice_id, amount, utr")
      .eq("merchant_id", device.merchant_id)
      .eq("amount", amount)
      .in("status", ["pending_payment", "pending_utr", "submitted"])
      .gte("created_at", cutoff)
      .gt("expires_at", now)   // Fix: skip expired invoices
      .order("created_at", { ascending: false })
      .limit(1);

    let matched = false;
    let matchedInvoiceId: string | null = null;

    if (pending && pending.length > 0) {
      const tx = pending[0];

      // Fix 4: block duplicate UTR — if this UTR already verified another invoice, skip
      if (utr) {
        const { data: dupCheck } = await supabase
          .from("transactions")
          .select("id")
          .eq("utr", utr)
          .eq("status", "verified")
          .limit(1);
        if (dupCheck && dupCheck.length > 0) {
          console.warn(`[notification-webhook] duplicate UTR blocked: ${utr}`);
          return json({ received: true, matched: false, reason: "duplicate_utr" });
        }
      }

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

        // Fix 9: include HMAC signature on merchant webhook
        if (merchant?.webhook_url && isSafeWebhookUrl(merchant.webhook_url)) {
          const payload = JSON.stringify({
            event: "payment.verified",
            invoice_id: tx.invoice_id,
            amount,
            utr,
            source,
            payer_vpa: payerVpa,
            timestamp: new Date().toISOString(),
          });
          const sig = await hmacSign(Deno.env.get("WEBHOOK_SECRET") ?? "default_secret", payload);
          fetch(merchant.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-EaglePay-Signature": sig,
            },
            body: payload,
          }).catch(console.error);
        } else if (merchant?.webhook_url) {
          console.warn("blocked unsafe webhook url", merchant.webhook_url);
        }
      }
    }

    console.log(`[notification-webhook] amount=${amount} utr=${utr} source=${source} matched=${matched} invoice=${matchedInvoiceId}`);
    return json({ received: true, matched, invoice_id: matchedInvoiceId });

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
