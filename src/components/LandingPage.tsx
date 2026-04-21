import { useState } from "react";
import { Button } from "@/components/ui/button";
import AuthForm from "./AuthForm";
import {
  QrCode, Smartphone, CheckCircle2, Webhook, ArrowRight, Shield, Zap,
  Code2, Download, ChevronDown, ChevronUp, MessageCircle, Mail,
  IndianRupee, Clock, Wifi, Star, Users, TrendingUp,
} from "lucide-react";

// Fix 1: point to GitHub release instead of Supabase storage
const APK_URL = "https://github.com/gwinner285-commits/UPI-listner/releases/latest/download/app-debug.apk";

const steps = [
  { icon: QrCode, title: "Dynamic QR Generated", desc: "Customer visits your checkout — our API generates a UPI QR with your VPA." },
  { icon: Smartphone, title: "Customer Pays via UPI", desc: "Money goes directly to your UPI account. No middleman, no hold." },
  { icon: CheckCircle2, title: "Auto or Manual Verify", desc: "Android app detects payment instantly. Or customer enters UTR manually." },
  { icon: Webhook, title: "Webhook Notification", desc: "Your server gets a signed callback with payment details. Verified and done." },
];

const features = [
  { icon: Zap, title: "0% Transaction Fee", desc: "We generate QR codes. Money flows directly to you — we never touch it." },
  { icon: Shield, title: "Direct to Your Account", desc: "Payments settle instantly in your own UPI-linked bank account." },
  { icon: Code2, title: "Simple API Integration", desc: "3 lines of code to add UPI payments to any website or app." },
  { icon: QrCode, title: "Multi-VPA Rotation", desc: "Add multiple UPI IDs. Auto-rotate to avoid daily limits." },
];

const stats = [
  { icon: Smartphone, value: "17+", label: "UPI Apps Supported" },
  { icon: Clock, value: "< 3s", label: "Detection Speed" },
  { icon: Wifi, value: "99.9%", label: "Uptime" },
  { icon: IndianRupee, value: "₹0", label: "Transaction Fees" },
];

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    desc: "Perfect to get started",
    features: ["Up to 50 transactions/month", "1 UPI ID", "Manual UTR verification", "Basic webhook", "Email support"],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹499",
    period: "/month",
    desc: "For growing businesses",
    features: ["Up to 500 transactions/month", "3 UPI IDs", "Auto-verify Android app", "Signed webhooks", "Priority support"],
    cta: "Start Pro",
    highlight: true,
  },
  {
    name: "Unlimited",
    price: "₹999",
    period: "/month",
    desc: "For high-volume merchants",
    features: ["Unlimited transactions", "Unlimited UPI IDs", "Auto-verify Android app", "Signed webhooks + retry", "Dedicated support"],
    cta: "Go Unlimited",
    highlight: false,
  },
];

const faqs = [
  {
    q: "Is Eagle Pay RBI compliant?",
    a: "Eagle Pay is a QR code generation service — we do not process or hold funds. All payments go directly from customer to your UPI-linked bank account via NPCI's UPI infrastructure, which is fully RBI regulated.",
  },
  {
    q: "Which UPI apps work with Eagle Pay?",
    a: "All major UPI apps work — GPay, PhonePe, Paytm, BHIM, Amazon Pay, WhatsApp Pay, and all bank apps. The QR uses the standard UPI deep-link format accepted by all apps.",
  },
  {
    q: "What if a payment fails or customer doesn't submit UTR?",
    a: "Invoices automatically expire after 15 minutes. The customer can retry by requesting a new payment link. If the Android app is installed, payments are detected automatically without UTR entry.",
  },
  {
    q: "How does the Android auto-verify app work?",
    a: "The app listens to UPI notification from apps like GPay and PhonePe. When a payment notification arrives, it extracts the amount and UTR and sends it to our server automatically — no manual entry needed.",
  },
  {
    q: "What is a webhook and do I need one?",
    a: "A webhook is a URL on your server that Eagle Pay calls when a payment is verified. It's optional — you can also check payment status via API polling. Webhooks are recommended for real-time order fulfillment.",
  },
  {
    q: "Is there a per-transaction fee?",
    a: "No. Eagle Pay charges a flat monthly subscription. There are zero per-transaction fees. The money goes directly from your customer's UPI app to your bank — we never touch it.",
  },
];

const testimonials = [
  { name: "Ravi Kumar", business: "Online Tutoring", text: "Set up in 10 minutes. My students pay via GPay and orders confirm instantly. No more manual bank checks!", stars: 5 },
  { name: "Priya Sharma", business: "Handmade Jewellery", text: "Finally a payment solution that doesn't take a cut. The auto-verify app is magic — I get notified before my customer even leaves the page.", stars: 5 },
  { name: "Mohammed Ali", business: "Digital Services", text: "Integrated with my WordPress site in one afternoon. The webhook API is clean and well documented.", stars: 5 },
];

const codeSnippet = `// 1. Create a payment invoice
const res = await fetch("https://your-project.supabase.co/functions/v1/create-invoice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ merchant_id: "YOUR_MERCHANT_ID", amount: 499 })
});
const { invoice_id, vpa, expires_at } = await res.json();

// 2. Show UPI QR to customer
const upiLink = \`upi://pay?pa=\${vpa}&am=499&tn=\${invoice_id}\`;

// 3. Receive webhook when payment verified
// POST https://yoursite.com/webhook
// { event: "payment.verified", invoice_id, amount, utr, timestamp }`;

export default function LandingPage() {
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (authMode) {
    return <AuthForm mode={authMode} onBack={() => setAuthMode(null)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 glass border-b border-border/30 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-lg">Eagle Pay</span>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <a href={APK_URL} download>
              <Download className="w-4 h-4 mr-1.5" /> Auto-Verify APK
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAuthMode("login")}>Login</Button>
          <Button size="sm" onClick={() => setAuthMode("register")}>Get Started</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 md:py-24">
        <div className="animate-float-in max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-muted-foreground mb-6">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Dynamic UPI QR Code Service
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
            Accept Payments{" "}
            <span className="text-gradient">Directly</span> to Your Account at{" "}
            <span className="text-gradient">0% Fee</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-4">
            Generate dynamic UPI QR codes for your website. Money goes straight to your bank account — no middleman, no delays.
          </p>
          <p className="text-xs text-muted-foreground mb-8">
            *Eagle Pay provides Dynamic QR generating service. Eagle Pay does not hold or process funds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="gradient-primary text-primary-foreground glow-primary px-8" onClick={() => setAuthMode("register")}>
              Start Accepting Payments <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={APK_URL} download>
                <Download className="w-4 h-4 mr-2" /> Get Auto-Verify App
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Install our lightweight Android app — payments verify instantly via UPI notifications. No manual UTR entry needed.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-12 border-t border-border/30">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className="glass rounded-xl p-5 text-center animate-float-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <s.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-gradient">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">How It Works</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
            How does Eagle Pay Dynamic QR work?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="glass rounded-xl p-6 animate-float-in relative" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm mb-4">
                  {i + 1}
                </div>
                <s.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">Why Eagle Pay</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
            Built for Indian Businesses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="glass rounded-xl p-6 animate-float-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <f.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Snippet - Fix 7 */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">Integration</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">
            Integrate in minutes
          </h2>
          <p className="text-center text-muted-foreground text-sm mb-8">
            3 simple steps — create invoice, show QR, receive webhook.
          </p>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">integration.js</span>
            </div>
            <pre className="p-5 text-xs font-mono text-left overflow-x-auto leading-relaxed text-muted-foreground">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing - Fix 2 */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">Pricing</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-4">Simple, transparent pricing</h2>
          <p className="text-center text-muted-foreground text-sm mb-12">No per-transaction fees. Ever.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 flex flex-col animate-float-in ${p.highlight ? "gradient-primary text-primary-foreground glow-primary" : "glass"}`} style={{ animationDelay: `${i * 0.1}s` }}>
                {p.highlight && (
                  <div className="text-xs font-bold uppercase tracking-wider mb-3 opacity-80">⭐ Most Popular</div>
                )}
                <h3 className={`font-bold text-lg mb-1 ${p.highlight ? "text-primary-foreground" : ""}`}>{p.name}</h3>
                <p className={`text-xs mb-4 ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.desc}</p>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{p.price}</span>
                  <span className={`text-sm mb-1 ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.period}</span>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className={`text-sm flex items-center gap-2 ${p.highlight ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={p.highlight ? "bg-white text-primary hover:bg-white/90 font-semibold" : "w-full"}
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => setAuthMode("register")}
                >
                  {p.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Fix 4 */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">Testimonials</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">Loved by Indian merchants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="glass rounded-xl p-6 animate-float-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.business}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ - Fix 5 */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-primary font-semibold text-center mb-2">FAQ</p>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-sm hover:bg-muted/20 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {f.q}
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground border-t border-border/30 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact - Fix 6 */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-primary font-semibold mb-2">Support</p>
          <h2 className="text-2xl md:text-4xl font-bold mb-4">Need help?</h2>
          <p className="text-muted-foreground text-sm mb-8">We're here to help you get set up and running.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="lg" asChild>
              <a href="mailto:support@eaglepay.in">
                <Mail className="w-4 h-4 mr-2" /> Email Support
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Support
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 md:py-20 border-t border-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">Ready to accept UPI payments?</h2>
          <p className="text-muted-foreground mb-8">Create your free account and integrate in under 5 minutes.</p>
          <Button size="lg" className="gradient-primary text-primary-foreground glow-primary px-8" onClick={() => setAuthMode("register")}>
            Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border/30">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">E</span>
            </div>
            <span className="text-sm font-semibold">Eagle Pay</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2026 Eagle Pay by Eagle Infotech Traders. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <a href="mailto:support@eaglepay.in" className="hover:text-foreground transition-colors">Contact</a>
            <a href={APK_URL} download className="hover:text-foreground transition-colors">Download APK</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
