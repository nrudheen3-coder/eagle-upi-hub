# 🦅 Eagle Pay — UPI Payment Gateway

> Accept UPI payments directly to your bank account at **0% transaction fee**. No middleman. No delays. Money goes straight to you.

![Eagle Pay Banner](https://eagle-upi-hub-v2.vercel.app)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-eagle--upi--hub--v2.vercel.app-blue)](https://eagle-upi-hub-v2.vercel.app)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20Supabase-orange)](https://supabase.com)

---

## 📖 What is Eagle Pay?

Eagle Pay is an open-source UPI payment gateway for Indian businesses. It generates dynamic UPI QR codes for your website and automatically verifies payments — either via an Android listener app or manual UTR submission.

**Key difference from Razorpay/Cashfree:** Money goes directly from customer to your UPI-linked bank account. Eagle Pay never holds or processes funds. We just generate the QR and verify the payment.

---

## 🏗️ System Architecture

```
Customer visits /pay page
        ↓
Invoice created in Supabase DB
        ↓
Customer pays via GPay / PhonePe / any UPI app
        ↓
    ┌───────────────────────────────┐
    │  Auto Path (Android App)      │
    │  Notification captured →      │
    │  Amount + UTR extracted →     │
    │  Webhook fired automatically  │
    └───────────────────────────────┘
              OR
    ┌───────────────────────────────┐
    │  Manual Path (No App)         │
    │  Customer enters UTR →        │
    │  Merchant approves/rejects    │
    └───────────────────────────────┘
        ↓
Transaction marked VERIFIED ✅
        ↓
Merchant webhook fired with payment details
```

---

## 📦 Repository Structure

```
eagle-upi-hub/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx        # Merchant dashboard (overview, UPI, listeners, API)
│   │   ├── AuthForm.tsx         # Login, register, forgot password
│   │   ├── LandingPage.tsx      # Public landing page
│   │   ├── PaymentGateway.tsx   # Customer payment page (/pay)
│   │   └── NavLink.tsx
│   ├── lib/
│   │   ├── api.ts               # All Supabase API calls
│   │   └── auth.ts              # Auth helpers
│   ├── pages/
│   │   ├── Index.tsx            # Main entry with auth routing
│   │   ├── Pay.tsx              # Public payment page
│   │   └── NotFound.tsx
│   └── integrations/
│       └── supabase/
│           └── client.ts        # Supabase client setup
├── supabase/
│   ├── functions/
│   │   ├── pair-device/         # Generate device token + pairing QR
│   │   ├── notification-webhook/ # Receive Android app payment events
│   │   ├── create-invoice/      # Create payment invoice
│   │   ├── submit-utr/          # Customer submits UTR manually
│   │   └── verify-utr/          # Merchant approves/rejects UTR
│   └── migrations/              # PostgreSQL schema migrations
└── README.md
```

---

## 🚀 Features

- ✅ **Dynamic UPI QR** — generates unique QR per invoice
- ✅ **Auto-verification** — Android app detects payments instantly via notifications
- ✅ **Manual UTR** — fallback for customers without Android app
- ✅ **Merchant Approval** — approve or reject manually submitted UTRs
- ✅ **Multi-VPA** — add multiple UPI IDs, auto-rotate
- ✅ **Signed Webhooks** — HMAC-SHA256 signed callbacks
- ✅ **Webhook Retry** — 3 attempts with exponential backoff
- ✅ **Invoice Expiry** — auto-expires after 15 minutes via pg_cron
- ✅ **Duplicate UTR Protection** — blocks reuse of same UTR
- ✅ **SSRF Protection** — blocks private/local webhook URLs
- ✅ **Rate Limiting** — 20 invoices per IP per minute
- ✅ **RLS Security** — row-level security on all tables

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Deployment | Vercel (frontend) + Supabase (backend) |
| Android App | Kotlin + NotificationListenerService |

---

## 📱 Android Listener App

The companion Android app listens to UPI notifications (GPay, PhonePe, Paytm, etc.) and auto-verifies payments without manual UTR entry.

**Download:** [eagle-pay-listener.apk](https://github.com/nrudheen3-coder/eagle-upi-hub/releases/latest/download/app-debug.apk)

**Supported apps:** GPay, PhonePe, Paytm, BHIM, Amazon Pay, WhatsApp Pay, ICICI, HDFC, SBI, Axis, Kotak, IndusInd, Federal, IDFC + SMS fallback (17+ apps)

**Source code:** [eagle-pay-listener-android](https://github.com/nrudheen3-coder/eagle-upi-hub)

---

## ⚡ Quick Start

### 1. Clone and install
```bash
git clone https://github.com/nrudheen3-coder/eagle-upi-hub.git
cd eagle-upi-hub
npm install
```

### 2. Set up Supabase
- Create a project at [supabase.com](https://supabase.com)
- Run all migrations from `supabase/migrations/` in order via SQL Editor
- Deploy edge functions:
```bash
supabase functions deploy pair-device
supabase functions deploy notification-webhook
supabase functions deploy submit-utr
supabase functions deploy create-invoice
supabase functions deploy verify-utr
supabase secrets set WEBHOOK_SECRET=your_secret_here
```
- Disable JWT verification for all 5 functions in Supabase dashboard

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 4. Run locally
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

---

## 🔌 API Integration

### Create an invoice
```javascript
const res = await fetch("https://YOUR_PROJECT.supabase.co/functions/v1/create-invoice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    merchant_id: "YOUR_MERCHANT_ID",
    amount: 499,
    customer_name: "John Doe" // optional
  })
});

const { invoice_id, vpa, expires_at } = await res.json();

// Show UPI QR to customer
const upiLink = `upi://pay?pa=${vpa}&am=499&tn=${invoice_id}`;
```

### Receive webhook
```javascript
// POST https://yoursite.com/webhook
// Headers: X-EaglePay-Signature: hmac_sha256_signature

{
  "event": "payment.verified",
  "invoice_id": "INV_abc123",
  "amount": 499,
  "utr": "412345678901",
  "source": "GPay",
  "payer_vpa": "customer@upi",
  "timestamp": "2026-04-22T12:00:00Z"
}
```

### Verify webhook signature
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return expected === signature;
}
```

---

## 💰 Pricing (Hosted Version)

| Plan | Price | Transactions | Features |
|---|---|---|---|
| Free | ₹0/month | 50/month | 1 UPI ID, Manual UTR |
| Pro | ₹499/month | 500/month | 3 UPI IDs, Auto-verify app |
| Unlimited | ₹999/month | Unlimited | Unlimited UPI IDs, Priority support |

**Self-hosted:** Free forever. Run your own instance using this repo.

---

## 🗄️ Database Schema

```
merchants          — merchant profiles, API keys, webhook URLs
vpas               — UPI VPA IDs per merchant
transactions       — invoices with status tracking
listener_devices   — paired Android devices
user_roles         — merchant/admin roles
```

---

## 🔒 Security

- All webhook URLs validated against SSRF attacks
- HMAC-SHA256 signatures on all outgoing webhooks
- Row Level Security (RLS) on all database tables
- Duplicate UTR detection across all transactions
- Invoice expiry enforced at both API and DB level
- JWT verification handled manually (supports ES256 + HS256)

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 👨‍💻 Built by

**Eagle Infotech Traders**  
📧 Email: support@eaglepay.in  
🌐 Website: [eagle-upi-hub-v2.vercel.app](https://eagle-upi-hub-v2.vercel.app)

---

> ⚠️ **Disclaimer:** Eagle Pay is a QR code generation and payment verification service. Eagle Pay does not hold, process, or transfer funds. All payments are processed directly through NPCI's UPI infrastructure. Merchants are responsible for compliance with applicable laws and regulations.
