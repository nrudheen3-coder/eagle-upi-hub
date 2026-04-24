// API client backed by Lovable Cloud (Supabase). Falls back to demo for guest /pay.
import { supabase } from "@/integrations/supabase/client";

export interface Merchant {
  id: string;
  businessName: string;
  vpaList: string[];
  activeVpaIndex: number;
  apiKey: string;
  webhookUrl?: string;
  matchWindowMinutes: number;
}

export interface Transaction {
  id: string;
  amount: number;
  utr: string;
  status: "pending_payment" | "pending_utr" | "submitted" | "verified" | "expired" | "failed";
  timestamp: string;
  payerVpa?: string;
  customerName?: string;
  matchedVia?: string;
}

export interface MerchantStats {
  todayTotal: number;
  totalTransactions: number;
  transactions: Transaction[];
}

export interface ListenerDevice {
  id: string;
  device_name: string;
  device_token: string;
  last_seen_at: string | null;
  created_at: string;
}

// ============ Helpers ============
// SSRF guard: only allow https public hosts; block localhost, private/link-local IPs, and metadata endpoints.
export function validateWebhookUrl(raw: string): void {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Webhook must be a valid URL"); }
  if (u.protocol !== "https:") throw new Error("Webhook must use https://");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host) ||         // link-local / AWS metadata
    /^fc[0-9a-f]{2}:/i.test(host) ||    // IPv6 unique-local
    /^fe80:/i.test(host) ||             // IPv6 link-local
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error("Webhook host is not allowed (private/local addresses are blocked)");
  }
}

async function loadMerchant(userId: string): Promise<Merchant | null> {
  const { data: m } = await supabase
    .from("merchants")
    .select("id, business_name, api_key, webhook_url, match_window_minutes")
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) return null;

  const { data: vpas } = await supabase
    .from("vpas")
    .select("vpa, is_active, created_at")
    .eq("merchant_id", m.id)
    .order("created_at");

  const list = (vpas ?? []).map(v => v.vpa);
  const activeIdx = Math.max(0, (vpas ?? []).findIndex(v => v.is_active));

  return {
    id: m.id,
    businessName: m.business_name,
    vpaList: list,
    activeVpaIndex: activeIdx === -1 ? 0 : activeIdx,
    apiKey: m.api_key,
    webhookUrl: m.webhook_url ?? undefined,
    matchWindowMinutes: m.match_window_minutes,
  };
}

function mapTxn(t: any): Transaction {
  return {
    id: t.invoice_id,
    amount: Number(t.amount),
    utr: t.utr ?? "",
    status: t.status,
    timestamp: t.created_at,
    payerVpa: t.payer_vpa ?? undefined,
    customerName: t.customer_name ?? undefined,
    matchedVia: t.matched_via ?? undefined,
  };
}

// ============ Public API ============
export const api = {
  async login(email: string, password: string): Promise<{ merchant: Merchant }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const merchant = await loadMerchant(data.user!.id);
    if (!merchant) throw new Error("Merchant profile not found");
    return { merchant };
  },

  async register(d: { email: string; password: string; businessName: string; vpa: string }): Promise<{ merchant: Merchant }> {
    const redirect = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        emailRedirectTo: redirect,
        data: { business_name: d.businessName, vpa: d.vpa },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Signup failed");
    // The DB trigger creates the merchant + vpa rows; load them
    let merchant: Merchant | null = null;
    for (let i = 0; i < 5 && !merchant; i++) {
      await new Promise(r => setTimeout(r, 200));
      merchant = await loadMerchant(data.user.id);
    }
    if (!merchant) throw new Error("Could not load merchant profile");
    return { merchant };
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async getCurrentMerchant(): Promise<Merchant | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return loadMerchant(data.user.id);
  },

  async getStats(): Promise<MerchantStats> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: m } = await supabase.from("merchants").select("id").eq("user_id", user.id).single();
    if (!m) throw new Error("Merchant not found");

    const { data: txns } = await supabase
      .from("transactions")
      .select("invoice_id, amount, utr, status, created_at, payer_vpa, customer_name, matched_via")
      .eq("merchant_id", m.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = (txns ?? []).map(mapTxn);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTotal = list
      .filter(t => (t.status === "verified" || t.status === "submitted") && new Date(t.timestamp) >= todayStart)
      .reduce((s, t) => s + t.amount, 0);

    return { todayTotal, totalTransactions: list.length, transactions: list };
  },

  // PUBLIC — used by /pay page, no auth
  async createInvoice(merchantId: string, amount: number) {
    const res = await fetch("/api/create-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_id: merchantId, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create invoice");
    return {
      invoiceId: data.invoice_id as string,
      vpa: data.vpa as string,
      businessName: data.business_name as string,
    };
  },

  async submitUtr(invoiceId: string, utr: string) {
    const res = await fetch("/api/submit-utr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoiceId, utr }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit UTR");
    return { success: !!data?.success };
  },

  // ============ VPAs ============
  async addVpa(vpa: string) {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    const { error } = await supabase.from("vpas").insert({ merchant_id: m.id, vpa, is_active: m.vpaList.length === 0 });
    if (error) throw error;
    return { success: true };
  },

  async removeVpa(vpa: string) {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    const { error } = await supabase.from("vpas").delete().eq("merchant_id", m.id).eq("vpa", vpa);
    if (error) throw error;
    return { success: true };
  },

  async setActiveVpa(index: number) {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    const target = m.vpaList[index];
    if (!target) throw new Error("Invalid VPA index");
    // Deactivate all, then activate the target
    await supabase.from("vpas").update({ is_active: false }).eq("merchant_id", m.id);
    const { error } = await supabase.from("vpas").update({ is_active: true }).eq("merchant_id", m.id).eq("vpa", target);
    if (error) throw error;
    return { success: true };
  },

  // ============ Webhook & API key ============
  async updateWebhook(url: string) {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    if (url) validateWebhookUrl(url);
    const { error } = await supabase.from("merchants").update({ webhook_url: url || null }).eq("id", m.id);
    if (error) throw error;
    return { success: true };
  },

  async regenerateApiKey() {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    const newKey = "ek_live_" + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("merchants").update({ api_key: newKey }).eq("id", m.id);
    if (error) throw error;
    return { apiKey: newKey };
  },

  // ============ Listener devices ============
  async listDevices(): Promise<ListenerDevice[]> {
    const m = await api.getCurrentMerchant();
    if (!m) return [];
    const { data } = await supabase
      .from("listener_devices")
      .select("id, device_name, device_token, last_seen_at, created_at")
      .eq("merchant_id", m.id)
      .order("created_at", { ascending: false });
    return (data ?? []) as ListenerDevice[];
  },

  async pairDevice(deviceName: string): Promise<{ pairing_payload: string; device_token: string; webhook_url: string }> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch("/api/pair-device", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ device_name: deviceName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Pairing failed");
    return data;
  },

  async removeDevice(id: string) {
    const m = await api.getCurrentMerchant();
    if (!m) throw new Error("Not authenticated");
    const { error } = await supabase.from("listener_devices").delete().eq("id", id).eq("merchant_id", m.id);
    if (error) throw error;
    return { success: true };
  },

  // ============ Manual UTR approval ============
  async verifyUtr(invoiceId: string, action: "approve" | "reject") {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch("/api/verify-utr", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ invoice_id: invoiceId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    return { success: !!data?.success, status: data?.status };
  },
  async _verifyUtrOld(invoiceId: string, action: "approve" | "reject") {
    const { data, error } = await supabase.functions.invoke("verify-utr-unused", {
      body: { invoice_id: invoiceId, action },
    });
    if (error) throw error;
    return { success: !!data?.success, status: data?.status };
  },
};
