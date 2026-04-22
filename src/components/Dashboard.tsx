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
  Smartphone, QrCode, Wifi, WifiOff, Loader2,
} from "lucide-react";

type Tab = "overview" | "upi" | "listeners" | "integration";

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
      </div>

      {/* Pairing dialog */}
      <Dialog open={!!pairingDialog} onOpenChange={open => !open && setPairingDialog(null)}>
        <DialogContent className="max-w-[95vw] w-full mx-2">
          <DialogHeader>
            <DialogTitle>Pair Your Phone</DialogTitle>
            <DialogDescription>Open the Eagle Pay Listener app and scan this QR.</DialogDescription>
          </DialogHeader>
          {pairingDialog && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-3 flex justify-center items-center w-full">
                <QRCodeSVG value={pairingDialog.payload} size={Math.min(240, window.innerWidth - 80)} level="M" />
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Webhook URL</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted/50 px-2 py-1.5 rounded font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap block min-w-0">{pairingDialog.webhook}</code>
                    <Button size="sm" variant="ghost" onClick={() => copyText(pairingDialog.webhook, "Webhook URL")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Device Token (keep secret)</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted/50 px-2 py-1.5 rounded font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap block min-w-0">{pairingDialog.token}</code>
                    <Button size="sm" variant="ghost" onClick={() => copyText(pairingDialog.token, "Device token")}>
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
