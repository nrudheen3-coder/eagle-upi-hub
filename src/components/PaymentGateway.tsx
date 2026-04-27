import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, IndianRupee, ArrowRight, Loader2, QrCode, Clock, AlertCircle } from "lucide-react";

interface PaymentGatewayProps {
  merchantId: string;
}

const EXPIRY_SECONDS = 15 * 60; // 15 minutes

export default function PaymentGateway({ merchantId }: PaymentGatewayProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "pay" | "utr" | "success" | "expired">("amount");
  const [invoiceId, setInvoiceId] = useState("");
  const [vpa, setVpa] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(EXPIRY_SECONDS);
  const [autoVerified, setAutoVerified] = useState(false);

  const upiLink = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=Payment-${invoiceId}`;

  // Fix 1: Countdown timer
  useEffect(() => {
    if (step !== "pay" && step !== "utr") return;
    if (timeLeft <= 0) { setStep("expired"); return; }
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setStep("expired"); clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Fix 2: Poll for auto-verification
  const pollStatus = useCallback(async () => {
    if (!invoiceId || step === "success" || step === "expired") return;
    try {
      const { data } = await supabase
        .from("transactions")
        .select("status")
        .eq("invoice_id", invoiceId)
        .single();
      if (data?.status === "verified") {
        setAutoVerified(true);
        setStep("success");
        playChime();
      }
    } catch {}
  }, [invoiceId, step]);

  useEffect(() => {
    if (step !== "pay" && step !== "utr") return;
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [step, pollStatus]);

  const playChime = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const timerColor = timeLeft < 60 ? "text-destructive" : timeLeft < 180 ? "text-warning" : "text-muted-foreground";

  const startPayment = async () => {
    const parsedAmt = parseFloat(amount);
    if (!amount || parsedAmt <= 0) return;
    if (parsedAmt > 200000) {
      setError("Maximum payment amount is ₹2,00,000");
      return;
    }
    setError("");
    try {
      const res = await api.createInvoice(merchantId, parseFloat(amount));
      setInvoiceId(res.invoiceId);
      setVpa(res.vpa);
      setBusinessName(res.businessName);
      setTimeLeft(EXPIRY_SECONDS);
      setStep("pay");
    } catch (e: any) {
      const msg = e?.message || "Could not create invoice.";
      if (msg.includes("Monthly limit")) {
        setError("This merchant has reached their monthly payment limit. Please contact them directly.");
      } else {
        setError(msg);
      }
    }
  };

  const handleSubmitUtr = async () => {
    if (!utr || utr.length < 6) return;
    setSubmitting(true);
    try {
      await api.submitUtr(invoiceId, utr);
      setStep("success");
      playChime();
    } catch (e: any) {
      setError(e?.message || "Could not submit UTR");
    } finally {
      setSubmitting(false);
    }
  };

  // Expired screen
  if (step === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-float-in">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invoice Expired</h1>
          <p className="text-muted-foreground mb-6">This payment link has expired. Please request a new one.</p>
          <Button className="gradient-primary text-primary-foreground" onClick={() => {
            setStep("amount");
            setInvoiceId("");
            setTimeLeft(EXPIRY_SECONDS);
            setError("");
          }}>
            Start New Payment
          </Button>
        </div>
      </div>
    );
  }

  // Success screen
  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-float-in">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {autoVerified ? "Payment Verified! ✅" : "Payment Submitted!"}
          </h1>
          <p className="text-muted-foreground mb-1">₹{parseFloat(amount).toLocaleString("en-IN")} to {businessName}</p>
          {utr && <p className="text-xs text-muted-foreground font-mono mb-1">UTR: {utr}</p>}
          <p className="text-xs text-muted-foreground font-mono">Invoice: {invoiceId}</p>
          {!autoVerified && (
            <p className="text-xs text-muted-foreground mt-4">The merchant will verify your payment shortly.</p>
          )}
          {autoVerified && (
            <p className="text-xs text-success mt-4">⚡ Payment automatically verified!</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground font-bold">E</span>
          </div>
          <h1 className="text-xl font-bold">
            {step === "amount" ? "Make Payment" : step === "utr" ? "Confirm Payment" : businessName}
          </h1>
          {step === "pay" && <p className="text-sm text-muted-foreground font-mono mt-1">{vpa}</p>}
        </div>

        {/* Fix 1: Timer bar */}
        {(step === "pay" || step === "utr") && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className={`w-4 h-4 ${timerColor}`} />
            <span className={`text-sm font-mono font-semibold ${timerColor}`}>
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs text-muted-foreground">remaining</span>
          </div>
        )}

        <div className="glass rounded-2xl p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              {error}
            </div>
          )}

          {step === "amount" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-9 text-2xl font-bold h-14"
                    min="1"
                    max="200000"
                    autoFocus
                  />
                </div>
              </div>
              <Button
                className="w-full gradient-primary text-primary-foreground h-12 text-base"
                onClick={startPayment}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Proceed to Pay
              </Button>
            </div>
          )}

          {step === "pay" && (
            <div className="text-center space-y-4">
              <p className="text-3xl font-bold text-gradient">₹{parseFloat(amount).toLocaleString("en-IN")}</p>
              <div className="bg-white rounded-xl p-3 inline-block">
                <QRCodeSVG value={upiLink} size={180} level="H" />
              </div>
              <p className="text-xs text-muted-foreground">Scan with any UPI app to pay</p>
              <a href={upiLink} className="block">
                <Button className="w-full gradient-primary text-primary-foreground h-12">
                  <QrCode className="w-4 h-4 mr-2" /> Open UPI App
                </Button>
              </a>
              {/* Fix 2: polling indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Waiting for payment...
              </div>
              <div className="border-t border-border/50 pt-4">
                <Button variant="outline" className="w-full" onClick={() => setStep("utr")}>
                  I've completed the payment <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === "utr" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-2xl font-bold text-gradient">₹{parseFloat(amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mt-1">to {businessName}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Enter UTR / Transaction Reference Number</label>
                <Input
                  value={utr}
                  onChange={e => setUtr(e.target.value)}
                  placeholder="e.g. 412345678901"
                  className="font-mono text-lg h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Find UTR in your UPI app → Transaction History → Payment Details
                </p>
              </div>
              <Button
                className="w-full gradient-primary text-primary-foreground h-12"
                onClick={handleSubmitUtr}
                disabled={!utr || utr.length < 6 || submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Payment Proof
              </Button>
              <Button variant="ghost" className="w-full text-sm" onClick={() => setStep("pay")}>
                ← Back to QR Code
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Eagle Pay • Secure UPI Payment
        </p>
      </div>
    </div>
  );
}
