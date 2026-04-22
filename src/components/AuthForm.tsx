import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AuthFormProps {
  mode: "login" | "register";
  onBack: () => void;
}

export default function AuthForm({ mode, onBack }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [vpa, setVpa] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState<"login" | "register" | "forgot">(mode);
  const [registered, setRegistered] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (currentMode === "login") {
        await api.login(email, password);
      } else if (currentMode === "register") {
        await api.register({ email, password, businessName, vpa });
        setRegistered(true);
      } else if (currentMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        setForgotSent(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center glass rounded-2xl p-8">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📧</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Check your email!</h2>
          <p className="text-muted-foreground mb-2">We sent a confirmation link to</p>
          <p className="font-semibold mb-6">{email}</p>
          <p className="text-sm text-muted-foreground mb-6">Click the link to confirm your account then come back and login.</p>
          <Button className="w-full gradient-primary text-primary-foreground" onClick={() => setCurrentMode("login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center glass rounded-2xl p-8">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Reset link sent!</h2>
          <p className="text-muted-foreground mb-6">Check your email for a password reset link.</p>
          <Button className="w-full gradient-primary text-primary-foreground" onClick={() => setCurrentMode("login")}>
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={onBack} className="mb-6 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">E</span>
            </div>
            <span className="font-semibold">Eagle Pay</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {currentMode === "login" ? "Welcome back" : currentMode === "register" ? "Create account" : "Reset password"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {currentMode === "login" ? "Enter your credentials to access your dashboard"
              : currentMode === "register" ? "Set up your merchant account"
              : "Enter your email to receive a reset link"}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" required />
            </div>
            {currentMode !== "forgot" && (
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            )}
            {currentMode === "register" && (
              <>
                <div>
                  <Label>Business Name</Label>
                  <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="My Shop" required />
                </div>
                <div>
                  <Label>UPI VPA</Label>
                  <Input value={vpa} onChange={e => setVpa(e.target.value)} placeholder="myshop@upi" required />
                </div>
              </>
            )}
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {currentMode === "login" ? "Sign In" : currentMode === "register" ? "Create Account" : "Send Reset Link"}
            </Button>
          </form>
          {currentMode === "login" && (
            <div className="mt-4 text-center space-y-2">
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCurrentMode("forgot")}>
                Forgot password?
              </button>
              <p className="text-xs text-muted-foreground">
                No account?{" "}
                <button className="text-primary hover:underline" onClick={() => setCurrentMode("register")}>Register</button>
              </p>
            </div>
          )}
          {currentMode === "register" && (
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Already have an account?{" "}
              <button className="text-primary hover:underline" onClick={() => setCurrentMode("login")}>Sign in</button>
            </p>
          )}
          {currentMode === "forgot" && (
            <button className="mt-4 w-full text-xs text-muted-foreground" onClick={() => setCurrentMode("login")}>
              ← Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
