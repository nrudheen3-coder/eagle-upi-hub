// Public endpoint: creates a transaction (invoice) for the hosted /pay page.
// No auth required — anyone with a merchant_id can request payment to that merchant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fix 8: simple in-memory rate limiter — max 20 invoices per IP per minute
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

  // Fix 8: rate limit by IP
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

    // Look up merchant + active VPA via SECURITY DEFINER function
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

    return json({
      invoice_id: txn.invoice_id,
      vpa,
      business_name,
      amount: txn.amount,
      expires_at: txn.expires_at,
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
