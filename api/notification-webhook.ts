import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

function hmacSign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (["localhost", "0.0.0.0", "::1"].includes(h)) return false;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type, x-device-token");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const deviceToken = req.headers["x-device-token"] as string;
  if (!deviceToken) return res.status(401).json({ error: "missing X-Device-Token" });

  try {
    const body = req.body;
    const amount = Number(body.amount);
    const utr = body.utr ? String(body.utr).replace(/\s+/g, "").toUpperCase() : null;
    const source = body.source ? String(body.source).slice(0, 50) : "unknown";
    const payerVpa = body.payer_vpa ? String(body.payer_vpa).slice(0, 100) : null;

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Heartbeat
    if (source === "heartbeat" || amount === 0) {
      const { data: device } = await supabase.from("listener_devices").select("id").eq("device_token", deviceToken).single();
      if (!device) return res.status(401).json({ error: "invalid device token" });
      await supabase.from("listener_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
      return res.status(200).json({ received: true, matched: false });
    }

    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "invalid amount" });

    const { data: device, error: devErr } = await supabase
      .from("listener_devices").select("id, merchant_id").eq("device_token", deviceToken).single();
    if (devErr || !device) return res.status(401).json({ error: "invalid device token" });

    await supabase.from("listener_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

    const { data: merchant } = await supabase
      .from("merchants").select("match_window_minutes, webhook_url").eq("id", device.merchant_id).single();

    const windowMin = merchant?.match_window_minutes ?? 5;
    const cutoff = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: pending } = await supabase
      .from("transactions").select("id, invoice_id, amount, utr")
      .eq("merchant_id", device.merchant_id).eq("amount", amount)
      .in("status", ["pending_payment", "pending_utr", "submitted"])
      .gte("created_at", cutoff).gt("expires_at", now)
      .order("created_at", { ascending: false }).limit(1);

    let matched = false;
    let matchedInvoiceId = null;

    if (pending && pending.length > 0) {
      const tx = pending[0];

      if (utr) {
        const { data: dup } = await supabase.from("transactions").select("id").eq("utr", utr).eq("status", "verified").limit(1);
        if (dup && dup.length > 0) return res.status(200).json({ received: true, matched: false, reason: "duplicate_utr" });
      }

      const { error: upErr } = await supabase.from("transactions").update({
        status: "verified", utr: utr || `LISTENER_${Date.now()}`,
        payer_vpa: payerVpa, matched_via: "notification_listener", matched_at: new Date().toISOString(),
      }).eq("id", tx.id);

      if (!upErr) {
        matched = true;
        matchedInvoiceId = tx.invoice_id;

        // Increment monthly tx count
        await supabase.rpc("increment_merchant_tx_count", { p_merchant_id: device.merchant_id });

        if (merchant?.webhook_url && isSafeUrl(merchant.webhook_url)) {
          const payload = JSON.stringify({
            event: "payment.verified", invoice_id: tx.invoice_id,
            amount, utr, source, payer_vpa: payerVpa, timestamp: new Date().toISOString(),
          });
          fetch(merchant.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-EaglePay-Signature": hmacSign(process.env.WEBHOOK_SECRET ?? "default_secret", payload) },
            body: payload,
          }).catch(console.error);
        }
      }
    }

    return res.status(200).json({ received: true, matched, invoice_id: matchedInvoiceId });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "invalid request" });
  }
}
