export default function Privacy() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: April 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. What We Collect</h2>
          <p>We collect your email address, business name, and UPI VPA when you register. We also store transaction records including invoice IDs, amounts, and UTR numbers for payment verification purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Data</h2>
          <p>Your data is used solely to operate the Eagle Pay service — generating payment QR codes, verifying payments, and sending webhook notifications to your server. We do not sell or share your data with third parties.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. Payment Data</h2>
          <p>Eagle Pay does not process or store payment card data. All UPI payments go directly from the customer to your UPI-linked bank account via NPCI's UPI infrastructure. We only store the transaction amount and UTR reference for verification purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Android App</h2>
          <p>The Eagle Pay Listener Android app reads UPI payment notifications from your device to enable automatic payment verification. This data is sent only to your own Eagle Pay account webhook and is never shared with third parties.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Data Retention</h2>
          <p>Transaction records are retained for 12 months. You can delete your account at any time from the Profile tab, which will permanently remove all your data.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Contact</h2>
          <p>For privacy concerns, contact us at support@eaglepay.in</p>
        </section>
      </div>
    </div>
  );
}
