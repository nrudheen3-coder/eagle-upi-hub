import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="text-center animate-float-in relative z-10 max-w-md">
        {/* Eagle logo */}
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 glow-primary">
          <span className="text-primary-foreground font-bold text-2xl">E</span>
        </div>

        {/* 404 number */}
        <div className="relative mb-4">
          <p className="text-8xl font-extrabold text-gradient leading-none select-none">404</p>
          <div className="absolute inset-0 text-8xl font-extrabold text-primary/5 blur-sm leading-none select-none">404</div>
        </div>

        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            className="gradient-primary text-primary-foreground glow-primary"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4 mr-2" /> Go Home
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          Eagle Pay — UPI Payment Gateway
        </p>
      </div>
    </div>
  );
}
