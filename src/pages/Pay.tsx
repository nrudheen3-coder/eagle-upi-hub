import { useSearchParams, useNavigate } from "react-router-dom";
import PaymentGateway from "@/components/PaymentGateway";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export default function Pay() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const merchantId = params.get("m");

  if (!merchantId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center animate-float-in max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invalid Payment Link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This payment link is missing or invalid. Please ask the merchant for a valid link.
          </p>
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" /> Go to Eagle Pay
          </Button>
        </div>
      </div>
    );
  }

  return <PaymentGateway merchantId={merchantId} />;
}
