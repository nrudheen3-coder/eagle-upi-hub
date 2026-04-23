import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, RefreshCw, Users, IndianRupee, ArrowRightLeft, 
  CheckCircle2, Clock, AlertCircle, Shield, Loader2, Search,
  TrendingUp, Smartphone, Ban
} from "lucide-react";

interface MerchantRow {
  id: string;
  user_id: string;
  business_name: string;
  plan: string;
  plan_expires_at: string | null;
  monthly_tx_count: number;
  api_key: string;
  webhook_url: string | null;
  created_at: string;
  email?: string;
  tx_total?: number;
}

const PLANS = ["free", "pro", "unlimited"];
const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground",
  pro: "text-primary",
  unlimited: "text-success",
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, free: 0, pro: 0, unlimited: 0, totalTx: 0 });
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, user_id, business_name, plan, plan_expires_at, monthly_tx_count, api_key, webhook_url, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get transaction counts per merchant
      const { data: txData } = await supabase
        .from("transactions")
        .select("merchant_id");

      const txCounts: Record<string, number> = {};
      (txData ?? []).forEach((t: any) => {
        txCounts[t.merchant_id] = (txCounts[t.merchant_id] || 0) + 1;
      });

      const enriched = (data ?? []).map((m: any) => ({
        ...m,
        tx_total: txCounts[m.id] || 0,
      }));

      setMerchants(enriched);
      setStats({
        total: enriched.length,
        free: enriched.filter(m => m.plan === "free").length,
        pro: enriched.filter(m => m.plan === "pro").length,
        unlimited: enriched.filter(m => m.plan === "unlimited").length,
        totalTx: Object.values(txCounts).reduce((a, b) => a + b, 0),
      });
    } catch (e: any) {
      toast({ title: "Error loading merchants", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const updatePlan = async (merchantId: string, plan: string) => {
    setUpdating(merchantId);
    try {
      const expiresAt = plan === "free" ? null
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("merchants")
        .update({ plan, plan_expires_at: expiresAt })
        .eq("id", merchantId);

      if (error) throw error;
      await fetchMerchants();
      toast({ title: `Plan updated to ${plan} ✅` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null); }
  };

  const resetTxCount = async (merchantId: string) => {
    setUpdating(merchantId + "_reset");
    try {
      const { error } = await supabase
        .from("merchants")
        .update({ monthly_tx_count: 0, monthly_tx_reset_at: new Date().toISOString() })
        .eq("id", merchantId);
      if (error) throw error;
      await fetchMerchants();
      toast({ title: "Transaction count reset ✅" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setUpdating(null); }
  };

  const filtered = merchants.filter(m =>
    m.business_name.toLowerCase().includes(search.toLowerCase()) ||
    m.plan.includes(search.toLowerCase())
  );

  const logout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass border-b border-border/30 px-4 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold">Eagle Pay Admin</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchMerchants}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Merchants", value: stats.total, icon: Users, color: "text-foreground" },
            { label: "Free", value: stats.free, icon: Clock, color: "text-muted-foreground" },
            { label: "Pro", value: stats.pro, icon: TrendingUp, color: "text-primary" },
            { label: "Unlimited", value: stats.unlimited, icon: CheckCircle2, color: "text-success" },
            { label: "Total Transactions", value: stats.totalTx, icon: ArrowRightLeft, color: "text-foreground" },
          ].map((s, i) => (
            <div key={i} className="glass rounded-xl p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by business name or plan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Merchants List */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Merchants ({filtered.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No merchants found</div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map(m => (
                <div key={m.id} className="p-4 space-y-3">
                  {/* Merchant Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{m.business_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">
                        Joined: {new Date(m.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold uppercase ${PLAN_COLORS[m.plan]}`}>
                        {m.plan}
                      </span>
                      {m.plan_expires_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Expires: {new Date(m.plan_expires_at).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" /> {m.tx_total} total txns
                    </span>
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> {m.monthly_tx_count} this month
                    </span>
                    {m.webhook_url && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="w-3 h-3" /> webhook set
                      </span>
                    )}
                  </div>

                  {/* Plan buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {PLANS.map(plan => (
                      <Button
                        key={plan}
                        size="sm"
                        variant={m.plan === plan ? "default" : "outline"}
                        className={`h-7 text-xs capitalize ${m.plan === plan ? "gradient-primary text-primary-foreground" : ""}`}
                        disabled={updating === m.id}
                        onClick={() => updatePlan(m.id, plan)}
                      >
                        {updating === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : plan}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-muted-foreground"
                      disabled={updating === m.id + "_reset"}
                      onClick={() => resetTxCount(m.id)}
                    >
                      {updating === m.id + "_reset" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reset Count"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
