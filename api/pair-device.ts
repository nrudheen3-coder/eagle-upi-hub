import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "missing auth" });

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return res.status(401).json({ error: "invalid session" });

    const { device_name } = req.body ?? {};
    const name = (device_name && String(device_name).slice(0, 50)) || "My Phone";

    const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user.id).single();
    if (!merchant) return res.status(404).json({ error: "merchant not found" });

    const { data: device, error } = await supabase
      .from("listener_devices")
      .insert({ merchant_id: merchant.id, device_name: name })
      .select("id, device_token, device_name, created_at")
      .single();
    if (error || !device) return res.status(500).json({ error: "could not create device" });

    // Use SITE_URL env var (set in Vercel to your production domain)
    // Falls back to request host so it works in preview deployments too
    const host = process.env.SITE_URL ?? `https://${req.headers.host}`;
    const webhookUrl = `${host}/api/notification-webhook`;

    return res.status(200).json({
      device_id: device.id,
      device_token: device.device_token,
      device_name: device.device_name,
      webhook_url: webhookUrl,
      pairing_payload: JSON.stringify({ v: 1, token: device.device_token, webhook: webhookUrl, name: device.device_name }),
    });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: "invalid request" });
  }
}
