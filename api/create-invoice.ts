import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_TX_LIMITS: Record<string, number> = {
  free: 50,
  pro: 500,
  unlimited: Infinity,
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
  res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "too many requests" });

  try {
    const { merchant_id, amount, customer_name } = req.body;
    if (!merchant_id) return res.status(400).json({ error: "merchant_id required" });

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 200000) {
      return res.status(400).json({ error: "amount must be between 1 and 200000" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Check plan limits
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, plan, plan_expires_at, monthly_tx_count, monthly_tx_reset_at")
      .eq("id", merchant_id)
      .single();

    if (!merchant) return res.status(404).json({ error: "merchant not found" });

    // Auto-downgrade expired plans
    let effectivePlan = merchant.plan ?? "free";
    if (effectivePlan !== "free" && merchant.plan_expires_at) {
      if (new Date(merchant.plan_expires_at) < new Date()) {
        effectivePlan = "free";
        await supabase.from("merchants").update({ plan: "free", plan_expires_at: null }).eq("id", merchant_id);
      }
    }

    // Reset monthly count if new month
    const resetAt = new Date(merchant.monthly_tx_reset_at ?? 0);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await supabase.from("merchants").update({ monthly_tx_count: 0, monthly_tx_reset_at: now.toISOString() }).eq("id", merchant_id);
      merchant.monthly_tx_count = 0;
    }

    // Enforce limit
    const limit = PLAN_TX_LIMITS[effectivePlan] ?? 50;
    if ((merchant.monthly_tx_count ?? 0) >= limit) {
      return res.status(429).json({
        error: `Monthly limit reached (${limit} transactions). Please upgrade your plan.`,
        plan: effectivePlan,
        limit,
      });
    }

    // Get VPA
    const { data: info } = await supabase.rpc("get_merchant_payment_info", { _merchant_id: merchant_id });
    if (!info || info.length === 0) return res.status(404).json({ error: "merchant not found" });
    const { business_name, vpa } = info[0];
    if (!vpa) return res.status(400).json({ error: "merchant has no active UPI VPA" });

    // Create invoice
    const { data: txn, error: txnErr } = await supabase
      .from("transactions")
      .insert({ merchant_id, amount: amt, customer_name: customer_name || null, status: "pending_payment" })
      .select("invoice_id, amount, expires_at")
      .single();

    if (txnErr || !txn) return res.status(500).json({ error: "failed to create invoice" });

    // Increment counter
    await supabase.from("merchants").update({ monthly_tx_count: (merchant.monthly_tx_count ?? 0) + 1 }).eq("id", merchant_id);

    return res.status(200).json({
      invoice_id: txn.invoice_id,
      vpa,
      business_name,
      amount: txn.amount,
      expires_at: txn.expires_at,
      plan: effectivePlan,
      tx_remaining: limit === Infinity ? null : limit - (merchant.monthly_tx_count ?? 0) - 1,
    });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "invalid request" });
  }
}
