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
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "missing auth" });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return res.status(401).json({ error: "invalid session" });

    const { invoice_id, action } = req.body;
    if (!invoice_id || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "invoice_id and action (approve|reject) required" });
    }

    const { data: merchant } = await supabase.from("merchants").select("id, webhook_url").eq("user_id", user.id).single();
    if (!merchant) return res.status(404).json({ error: "merchant not found" });

    const { data: txn } = await supabase.from("transactions")
      .select("id, invoice_id, amount, utr, status, payer_vpa")
      .eq("invoice_id", invoice_id).eq("merchant_id", merchant.id).single();

    if (!txn) return res.status(404).json({ error: "invoice not found" });
    if (txn.status !== "submitted") return res.status(400).json({ error: `cannot ${action} invoice with status: ${txn.status}` });

    const newStatus = action === "approve" ? "verified" : "failed";
    await supabase.from("transactions").update({
      status: newStatus, matched_via: "manual_approval", matched_at: new Date().toISOString(),
    }).eq("id", txn.id);

    if (action === "approve" && merchant.webhook_url && isSafeUrl(merchant.webhook_url)) {
      const payload = JSON.stringify({
        event: "payment.verified", invoice_id: txn.invoice_id,
        amount: txn.amount, utr: txn.utr, source: "manual_approval",
        payer_vpa: txn.payer_vpa, timestamp: new Date().toISOString(),
      });
      fetch(merchant.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-EaglePay-Signature": hmacSign(process.env.WEBHOOK_SECRET ?? "default_secret", payload) },
        body: payload,
      }).catch(console.error);
    }

    return res.status(200).json({ success: true, status: newStatus });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "invalid request" });
  }
}
