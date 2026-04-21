import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, IndianRupee, ArrowRight, Loader2, QrCode } from "lucide-react";

interface PaymentGatewayProps {
  merchantId: string;
}

export default function PaymentGateway({ merchantId }: PaymentGatewayProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "pay" | "utr" | "success">("amount");
  const [invoiceId, setInvoiceId] = useState("");
  const [vpa, setVpa] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const upiLink = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(businessName)}&am=${amount}&cu=INR&tn=Payment-${invoiceId}`;

  const [error, setError] = useState("");

  const startPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setError("");
    try {
      const res = await api.createInvoice(merchantId, parseFloat(amount));
      setInvoiceId(res.invoiceId);
      setVpa(res.vpa);
      setBusinessName(res.businessName);
      setStep("pay");
    } catch (e: any) {
      setError(e?.message || "Could not create invoice. Check the merchant link.");
    }
  };

  const handleSubmitUtr = async () => {
    if (!utr || utr.length < 6) return;
    setSubmitting(true);
    try {
      await api.submitUtr(invoiceId, utr);
      setStep("success");
      // Play chime
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
    } catch (e: any) {
      setError(e?.message || "Could not submit UTR");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-float-in">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6 animate-success-pulse glow-success">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Submitted!</h1>
          <p className="text-muted-foreground mb-1">₹{parseFloat(amount).toLocaleString("en-IN")} to {businessName}</p>
          <p className="text-xs text-muted-foreground font-mono mb-1">UTR: {utr}</p>
          <p className="text-xs text-muted-foreground font-mono">Invoice: {invoiceId}</p>
          <p className="text-xs text-muted-foreground mt-4">The merchant will verify your payment shortly.</p>
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
              <div className="bg-foreground rounded-xl p-4 inline-block">
                <QRCodeSVG value={upiLink} size={180} level="H" />
              </div>
              <p className="text-xs text-muted-foreground">Scan with any UPI app to pay</p>
              <a href={upiLink} className="block">
                <Button className="w-full gradient-primary text-primary-foreground h-12">
                  <QrCode className="w-4 h-4 mr-2" /> Open UPI App
                </Button>
              </a>
              <div className="border-t border-border/50 pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep("utr")}
                >
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
