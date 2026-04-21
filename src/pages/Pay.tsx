import { useSearchParams } from "react-router-dom";
import PaymentGateway from "@/components/PaymentGateway";

export default function Pay() {
  const [params] = useSearchParams();
  const merchantId = params.get("m");

  if (!merchantId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Invalid payment link.
      </div>
    );
  }

  return <PaymentGateway merchantId={merchantId} />;
}
