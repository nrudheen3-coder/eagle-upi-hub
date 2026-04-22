export default function Terms() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm mb-8">Last updated: April 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">1. Service Description</h2>
          <p>Eagle Pay provides a UPI payment QR code generation and verification service. We are not a payment processor, bank, or financial institution. All funds flow directly between customers and merchants via NPCI's UPI infrastructure.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">2. Merchant Responsibilities</h2>
          <p>Merchants are responsible for ensuring their use of Eagle Pay complies with applicable laws and RBI regulations. Merchants must not use Eagle Pay for illegal activities, money laundering, or any activity that violates NPCI's UPI usage guidelines.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">3. No Liability for Payments</h2>
          <p>Eagle Pay is not liable for failed, delayed, or disputed UPI payments. Payment disputes must be resolved directly between the merchant and customer through their respective banks or UPI apps.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">4. Service Availability</h2>
          <p>Eagle Pay aims for 99.9% uptime but does not guarantee uninterrupted service. We are not liable for losses resulting from service downtime.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">5. Account Termination</h2>
          <p>We reserve the right to terminate accounts that violate these terms. You may delete your account at any time from the Profile tab.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">6. Governing Law</h2>
          <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in India.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">7. Contact</h2>
          <p>For legal queries, contact us at support@eaglepay.in</p>
        </section>
      </div>
    </div>
  );
}
