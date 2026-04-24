// Public endpoint: creates a transaction (invoice) for the hosted /pay page.
// No auth required — anyone with a merchant_id can request payment to that merchant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan limits
const PLAN_TX_LIMITS: Record<string, number> = {
  free: 50,
  pro: 500,
  unlimited: Infinity,
};

// Simple in-memory rate limiter — max 20 invoices per IP per minute
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return json({ error: "too many requests, slow down" }, 429);
  }

  try {
    const { merchant_id, amount, customer_name } = await req.json();

    if (!merchant_id || typeof merchant_id !== "string") {
      return json({ error: "merchant_id required" }, 400);
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 200000) {
      return json({ error: "amount must be between 1 and 200000" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fix 1: Check plan limits
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, plan, plan_expires_at, monthly_tx_count, monthly_tx_reset_at")
      .eq("id", merchant_id)
      .single();

    if (!merchant) return json({ error: "merchant not found" }, 404);

    // Check if paid plan has expired → downgrade to free
    let effectivePlan = merchant.plan;
    if (effectivePlan !== "free" && merchant.plan_expires_at) {
      if (new Date(merchant.plan_expires_at) < new Date()) {
        effectivePlan = "free";
        await supabase
          .from("merchants")
          .update({ plan: "free", plan_expires_at: null })
          .eq("id", merchant_id);
      }
    }

    // Reset monthly count if new month
    const resetAt = new Date(merchant.monthly_tx_reset_at ?? 0);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await supabase
        .from("merchants")
        .update({ monthly_tx_count: 0, monthly_tx_reset_at: now.toISOString() })
        .eq("id", merchant_id);
      merchant.monthly_tx_count = 0;
    }

    // Enforce transaction limit
    const limit = PLAN_TX_LIMITS[effectivePlan] ?? 50;
    if (merchant.monthly_tx_count >= limit) {
      return json({
        error: `Monthly limit reached (${limit} transactions). Please upgrade your plan.`,
        plan: effectivePlan,
        limit,
        upgrade_url: `${Deno.env.get("SITE_URL") ?? ""}/`,
      }, 429);
    }

    // Look up active VPA
    const { data: info, error: infoErr } = await supabase
      .rpc("get_merchant_payment_info", { _merchant_id: merchant_id });

    if (infoErr || !info || info.length === 0) {
      return json({ error: "merchant not found" }, 404);
    }
    const { business_name, vpa } = info[0];
    if (!vpa) return json({ error: "merchant has no active UPI VPA" }, 400);

    // Insert transaction
    const { data: txn, error: txnErr } = await supabase
      .from("transactions")
      .insert({
        merchant_id,
        amount: amt,
        customer_name: customer_name || null,
        status: "pending_payment",
      })
      .select("invoice_id, amount, expires_at")
      .single();

    if (txnErr || !txn) {
      console.error("insert error", txnErr);
      return json({ error: "failed to create invoice" }, 500);
    }

    // Fix 2: Increment monthly transaction counter
    await supabase
      .from("merchants")
      .update({ monthly_tx_count: (merchant.monthly_tx_count ?? 0) + 1 })
      .eq("id", merchant_id);

    return json({
      invoice_id: txn.invoice_id,
      vpa,
      business_name,
      amount: txn.amount,
      expires_at: txn.expires_at,
      plan: effectivePlan,
      tx_remaining: limit === Infinity ? null : limit - merchant.monthly_tx_count - 1,
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
