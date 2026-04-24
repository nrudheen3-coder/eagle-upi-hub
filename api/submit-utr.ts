import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

async function fireWebhookWithRetry(webhookUrl: string, payload: object, secret: string, attempts = 3) {
  const body = JSON.stringify(payload);
  const sig = hmacSign(secret, body);
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-EaglePay-Signature": sig },
        body,
      });
      if (res.ok) return;
    } catch {}
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
  res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { invoice_id, utr } = req.body;
    if (!invoice_id || !utr) return res.status(400).json({ error: "invoice_id and utr required" });

    const cleanUtr = String(utr).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{6,30}$/.test(cleanUtr)) return res.status(400).json({ error: "invalid UTR format" });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: existing } = await supabase
      .from("transactions").select("id, status, merchant_id, amount, expires_at")
      .eq("invoice_id", invoice_id).single();

    if (!existing) return res.status(404).json({ error: "invoice not found" });
    if (existing.status === "verified") return res.status(200).json({ success: true, already_verified: true });
    if (["expired", "failed"].includes(existing.status)) return res.status(400).json({ error: "invoice expired or failed" });
    if (new Date(existing.expires_at) < new Date()) {
      await supabase.from("transactions").update({ status: "expired" }).eq("id", existing.id);
      return res.status(400).json({ error: "invoice has expired" });
    }

    // Check duplicate UTR
    const { data: dup } = await supabase.from("transactions").select("id").eq("utr", cleanUtr).eq("status", "verified").limit(1);
    if (dup && dup.length > 0) return res.status(400).json({ error: "UTR already used for another payment" });

    await supabase.from("transactions").update({
      utr: cleanUtr, status: "submitted",
      matched_via: "manual_utr", matched_at: new Date().toISOString(),
    }).eq("id", existing.id).in("status", ["pending_payment", "pending_utr"]);

    // Fire webhook
    const { data: m } = await supabase.from("merchants").select("webhook_url").eq("id", existing.merchant_id).single();
    if (m?.webhook_url && isSafeUrl(m.webhook_url)) {
      fireWebhookWithRetry(m.webhook_url, {
        event: "payment.utr_submitted", invoice_id, utr: cleanUtr, timestamp: new Date().toISOString(),
      }, process.env.WEBHOOK_SECRET ?? "default_secret").catch(console.error);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "invalid request" });
  }
}
