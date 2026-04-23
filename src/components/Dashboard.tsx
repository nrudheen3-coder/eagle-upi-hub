import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, Merchant, MerchantStats, Transaction, ListenerDevice } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  IndianRupee, ArrowRightLeft, Copy, LogOut, CheckCircle2, Clock, Key, Webhook,
  Plus, Trash2, Radio, Code2, RefreshCw, Eye, EyeOff, AlertCircle, Send,
  Smartphone, QrCode, Wifi, WifiOff, Loader2, User, Lock, FileText, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "overview" | "upi" | "listeners" | "integration" | "profile";

interface DashboardProps {
  initialMerchant: Merchant;
}

export default function Dashboard({ initialMerchant }: DashboardProps) {
  const [merchant, setMerchant] = useState<Merchant>(initialMerchant);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [devices, setDevices] = useState<ListenerDevice[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showApiKey, setShowApiKey] = useState(false);
  const [newVpa, setNewVpa] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(initialMerchant.webhookUrl || "");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [pairingDialog, setPairingDialog] = useState<{ payload: string; token: string; webhook: string } | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [pairing, setPairing] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState(initialMerchant.businessName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [matchWindow, setMatchWindow] = useState(initialMerchant.matchWindowMinutes ?? 5);
  const [savingWindow, setSavingWindow] = useState(false);
  const { toast } = useToast();

  const payLink = `${window.location.origin}/pay?m=${merchant.id}`;

  const refreshMerchant = useCallback(async () => {
    const m = await api.getCurrentMerchant();
    if (m) setMerchant(m);
  }, []);

  const fetchStats = useCallback(async () => {
    try { setStats(await api.getStats()); } catch { /* ignore */ }
  }, []);

  const fetchDevices = useCallback(async () => {
    try { setDevices(await api.listDevices()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchDevices();
    const interval = setInterval(() => { fetchStats(); fetchDevices(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchDevices]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  const logout = async () => { await auth.logout(); };

  const handleAddVpa = async () => {
    if (!newVpa.includes("@")) {
      toast({ title: "Invalid VPA", description: "Enter a valid UPI ID (e.g. name@upi)", variant: "destructive" });
      return;
    }
    try {
      await api.addVpa(newVpa);
      await refreshMerchant();
      setNewVpa("");
      toast({ title: "VPA Added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemoveVpa = async (vpa: string) => {
    if (merchant.vpaList.length <= 1) {
      toast({ title: "Cannot Remove", description: "You need at least one UPI ID.", variant: "destructive" });
      return;
    }
    await api.removeVpa(vpa);
    await refreshMerchant();
    toast({ title: "VPA Removed" });
  };

  const handleSetActive = async (index: number) => {
    await api.setActiveVpa(index);
    await refreshMerchant();
    toast({ title: "Active VPA Updated" });
  };

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await api.updateWebhook(webhookUrl);
      await refreshMerchant();
      toast({ title: "Webhook Saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingWebhook(false); }
  };

  const handleRegenKey = async () => {
    await api.regenerateApiKey();
    await refreshMerchant();
    setShowApiKey(true);
    toast({ title: "API Key Regenerated", description: "Your old key is now invalid." });
  };

  // ===== PROFILE HANDLERS =====
  const handleSaveProfile = async () => {
    if (!newBusinessName.trim()) return;
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("merchants")
        .update({ business_name: newBusinessName.trim() })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshMerchant();
      toast({ title: "Profile Updated ✅" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: "Password Changed ✅" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  const handleSaveMatchWindow = async () => {
    setSavingWindow(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("merchants")
        .update({ match_window_minutes: matchWindow })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Match Window Updated ✅" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSavingWindow(false); }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm("Are you sure? This will permanently delete your account and all data. This cannot be undone.");
    if (!confirm) return;
    try {
      await supabase.auth.signOut();
      toast({ title: "Account deleted. Goodbye!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleExportCSV = () => {
    if (!stats?.transactions?.length) return;
    const headers = ["Invoice ID", "Amount", "UTR", "Status", "Source", "Payer VPA", "Date"];
    const rows = stats.transactions.map(t => [
      t.id, t.amount, t.utr || "", t.status, t.matchedVia || "", t.payerVpa || "",
      new Date(t.timestamp).toLocaleString("en-IN")
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eagle-pay-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerifyUtr = async (invoiceId: string, action: "approve" | "reject") => {
    try {
      await api.verifyUtr(invoiceId, action);
      await fetchStats();
      toast({
        title: action === "approve" ? "Payment Approved ✅" : "Payment Rejected ❌",
        description: `Invoice ${invoiceId} has been ${action === "approve" ? "verified" : "rejected"}.`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handlePairDevice = async () => {
    const name = newDeviceName.trim() || "My Phone";
    setPairing(true);
    try {
      const res = await api.pairDevice(name);
      setPairingDialog({ payload: res.pairing_payload, token: res.device_token, webhook: res.webhook_url });
      setNewDeviceName("");
      await fetchDevices();
    } catch (e: any) {
      toast({ title: "Pairing failed", description: e.message, variant: "destructive" });
    } finally { setPairing(false); }
  };

  const handleRemoveDevice = async (id: string) => {
    await api.removeDevice(id);
    await fetchDevices();
    toast({ title: "Device Removed" });
  };

  const isDeviceActive = (d: ListenerDevice) => {
    if (!d.last_seen_at) return false;
    return Date.now() - new Date(d.last_seen_at).getTime() < 2 * 60 * 1000; // 2 min
  };

  const statusIcon = (status: Transaction["status"]) => {
    switch (status) {
      case "verified": return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "submitted": return <Send className="w-4 h-4 text-primary" />;
      case "expired":
      case "failed": return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const statusLabel = (status: Transaction["status"]) => ({
    verified: "Verified",
    submitted: "UTR Submitted — Awaiting Approval",
    pending_utr: "Awaiting UTR",
    pending_payment: "Pending",
    expired: "Expired",
    failed: "Failed",
  }[status]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <IndianRupee className="w-4 h-4" /> },
    { id: "upi", label: "UPI IDs", icon: <Radio className="w-4 h-4" /> },
    { id: "listeners", label: "Listeners", icon: <Smartphone className="w-4 h-4" /> },
    { id: "integration", label: "API", icon: <Code2 className="w-4 h-4" /> },
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
  ];

  const activeVpa = merchant.vpaList?.[merchant.activeVpaIndex] ?? merchant.vpaList?.[0] ?? "—";

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-border/30 px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <div>
            <p className="font-semibold text-sm md:text-base">{merchant.businessName}</p>
            <p className="text-xs text-muted-foreground font-mono">{activeVpa}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Logout</span>
        </Button>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 glass rounded-xl p-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-float-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-6 glow-primary">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <IndianRupee className="w-4 h-4" /> Collected Today
                </div>
                <p className="text-3xl md:text-4xl font-bold text-gradient">
                  ₹{stats?.todayTotal?.toLocaleString("en-IN") ?? "—"}
                </p>
              </div>
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <ArrowRightLeft className="w-4 h-4" /> Total Transactions
                </div>
                <p className="text-3xl md:text-4xl font-bold">{stats?.totalTransactions ?? "—"}</p>
              </div>
            </div>

            {/* Listener status banner */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {devices.some(isDeviceActive) ? (
                    <><Wifi className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-sm">Listener Active</p>
                      <p className="text-xs text-muted-foreground">{devices.filter(isDeviceActive).length} device(s) online — auto-verifying payments</p>
                    </div></>
                  ) : (
                    <><WifiOff className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">No Listener Connected</p>
                      <p className="text-xs text-muted-foreground">Customers must enter UTR manually</p>
                    </div></>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab("listeners")}>Manage</Button>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground mb-2">Your Payment Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted/50 px-3 py-2 rounded-lg text-xs md:text-sm font-mono truncate">{payLink}</code>
                <Button size="sm" variant="outline" onClick={() => copyText(payLink, "Payment link")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Key className="w-4 h-4" /> API Key</p>
                <Button size="sm" variant="ghost" onClick={handleRegenKey}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted/50 px-3 py-2 rounded-lg text-xs md:text-sm font-mono truncate">
                  {showApiKey ? merchant.apiKey : "ek_live_••••••••••••••••••••"}
                </code>
                <Button size="sm" variant="ghost" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyText(merchant.apiKey, "API key")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <ArrowRightLeft className="w-4 h-4 text-primary" /> Recent Transactions
              </h3>
              {!stats?.transactions?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {stats.transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        {statusIcon(tx.status)}
                        <div>
                          <p className="text-sm font-medium">₹{tx.amount.toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tx.utr || statusLabel(tx.status)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {tx.status === "submitted" ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-success border-success/50 hover:bg-success/10"
                              onClick={() => handleVerifyUtr(tx.id, "approve")}>
                              ✅ Approve
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                              onClick={() => handleVerifyUtr(tx.id, "reject")}>
                              ❌ Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {tx.matchedVia === "notification_listener" && (
                              <p className="text-[10px] text-success">⚡ auto-verified</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* UPI */}
        {activeTab === "upi" && (
          <div className="space-y-6 animate-float-in">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1">UPI VPA Management</h3>
              <p className="text-sm text-muted-foreground mb-4">Add multiple UPI IDs. The active one receives payments. Switch to avoid daily limits.</p>

              <div className="space-y-3 mb-4">
                {merchant.vpaList?.map((vpa, i) => (
                  <div key={vpa} className={`flex items-center justify-between p-3 rounded-lg ${i === merchant.activeVpaIndex ? "bg-primary/10 border border-primary/30" : "bg-muted/30"}`}>
                    <div className="flex items-center gap-3">
                      <Radio className={`w-4 h-4 ${i === merchant.activeVpaIndex ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-mono font-medium">{vpa}</p>
                        {i === merchant.activeVpaIndex && <p className="text-xs text-primary">Active — receiving payments</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {i !== merchant.activeVpaIndex && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleSetActive(i)}>Set Active</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveVpa(vpa)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input value={newVpa} onChange={e => setNewVpa(e.target.value)} placeholder="newupi@paytm" className="font-mono text-sm" />
                <Button onClick={handleAddVpa} disabled={!newVpa}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* LISTENERS */}
        {activeTab === "listeners" && (
          <div className="space-y-6 animate-float-in">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" /> Notification Listeners</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Pair an Android phone running the Eagle Pay Listener app. It reads UPI notifications (GPay, PhonePe, Paytm, bank apps) and auto-verifies payments instantly.
              </p>

              <div className="space-y-3 mb-4">
                {devices.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No devices paired yet</p>
                )}
                {devices.map(d => {
                  const active = isDeviceActive(d);
                  return (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        {active ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-medium">{d.device_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {active ? "Online" : d.last_seen_at ? `Last seen ${new Date(d.last_seen_at).toLocaleString()}` : "Never connected"}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveDevice(d.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Input value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} placeholder="Shop counter phone" />
                <Button onClick={handlePairDevice} disabled={pairing}>
                  {pairing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <QrCode className="w-4 h-4 mr-1" />}
                  Pair Device
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* INTEGRATION */}
        {activeTab === "integration" && (
          <div className="space-y-6 animate-float-in">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Webhook className="w-4 h-4 text-primary" /> Webhook URL</h3>
              <p className="text-sm text-muted-foreground mb-4">We POST payment confirmations to this URL.</p>
              <div className="flex gap-2">
                <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://yoursite.com/api/payment-webhook" className="font-mono text-xs" />
                <Button onClick={handleSaveWebhook} disabled={savingWebhook}>Save</Button>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Code2 className="w-4 h-4 text-primary" /> Quick Start</h3>
              <p className="text-sm text-muted-foreground mb-4">Easiest way: redirect customers to your hosted payment link.</p>
              <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`<a href="${payLink}">Pay with UPI</a>`}
              </pre>
              <p className="text-xs text-muted-foreground mt-3 mb-1 font-semibold">Webhook payload</p>
              <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`POST ${webhookUrl || "https://yoursite.com/webhook"}
{
  "event": "payment.verified",
  "invoice_id": "INV_abc...",
  "amount": 500,
  "utr": "412345678901",
  "source": "GPay",
  "timestamp": "2026-04-18T12:00:00Z"
}`}
              </pre>
            </div>
          </div>
        )}

        {/* PROFILE - Fix 5,6,9,10,11 */}
        {activeTab === "profile" && (
          <div className="space-y-6 animate-float-in">

            {/* Business Name */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Business Profile</h3>
              <p className="text-sm text-muted-foreground mb-4">Update your business name shown to customers.</p>
              <div className="flex gap-2">
                <Input value={newBusinessName} onChange={e => setNewBusinessName(e.target.value)} placeholder="My Business" />
                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>

            {/* Change Password - Fix 5 */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Change Password</h3>
              <p className="text-sm text-muted-foreground mb-4">Update your account password.</p>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    minLength={6}
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button className="w-full" onClick={handleChangePassword} disabled={savingPassword || newPassword.length < 6}>
                  {savingPassword ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Lock className="w-4 h-4 mr-1" />}
                  Update Password
                </Button>
              </div>
            </div>

            {/* Match Window - Fix 6 */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Payment Match Window</h3>
              <p className="text-sm text-muted-foreground mb-4">How long to look back for matching payments (in minutes). Default: 5 min.</p>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={matchWindow}
                  onChange={e => setMatchWindow(Number(e.target.value))}
                  min={1} max={60}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
                <Button onClick={handleSaveMatchWindow} disabled={savingWindow}>
                  {savingWindow ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>

            {/* Export CSV - Fix 11 */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2"><Download className="w-4 h-4 text-primary" /> Export Transactions</h3>
              <p className="text-sm text-muted-foreground mb-4">Download your transaction history as a CSV file.</p>
              <Button variant="outline" onClick={handleExportCSV} disabled={!stats?.transactions?.length}>
                <Download className="w-4 h-4 mr-2" /> Download CSV ({stats?.transactions?.length ?? 0} transactions)
              </Button>
            </div>

            {/* Privacy & Terms - Fix 7,8 */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Legal</h3>
              <div className="space-y-2">
                <a href="/privacy" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="w-4 h-4" /> Privacy Policy
                </a>
                <a href="/terms" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="w-4 h-4" /> Terms of Service
                </a>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="glass rounded-2xl p-5 border border-destructive/30">
              <h3 className="font-semibold mb-1 text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all data. This cannot be undone.</p>
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={handleDeleteAccount}>
                Delete Account
              </Button>
            </div>

          </div>
        )}
      </div>

      {/* Pairing dialog */}
      <Dialog open={!!pairingDialog} onOpenChange={open => !open && setPairingDialog(null)}>
        <DialogContent className="w-[92vw] max-w-sm p-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pair Your Phone</DialogTitle>
            <DialogDescription>Open the Eagle Pay Listener app and scan this QR.</DialogDescription>
          </DialogHeader>
          {pairingDialog && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl p-3 flex justify-center items-center w-full">
                <QRCodeSVG
                  value={pairingDialog.payload}
                  size={Math.min(220, Math.round(window.innerWidth * 0.72))}
                  level="M"
                  style={{ display: "block", maxWidth: "100%" }}
                />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Webhook URL</p>
                  <div className="flex gap-1 items-center">
                    <code className="flex-1 bg-muted/50 px-2 py-1.5 rounded font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap block min-w-0">
                      {pairingDialog.webhook}
                    </code>
                    <Button size="sm" variant="ghost" className="shrink-0 h-7 w-7 p-0" onClick={() => copyText(pairingDialog.webhook, "Webhook URL")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Device Token (keep secret)</p>
                  <div className="flex gap-1 items-center">
                    <code className="flex-1 bg-muted/50 px-2 py-1.5 rounded font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap block min-w-0">
                      {pairingDialog.token}
                    </code>
                    <Button size="sm" variant="ghost" className="shrink-0 h-7 w-7 p-0" onClick={() => copyText(pairingDialog.token, "Device token")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                The device will appear as "Online" once it sends its first heartbeat.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
