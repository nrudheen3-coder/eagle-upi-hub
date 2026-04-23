import { useEffect, useState } from "react";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import Admin from "@/pages/Admin";
import { supabase } from "@/integrations/supabase/client";
import { api, Merchant } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  };

  const loadMerchant = async (retries = 5): Promise<Merchant | null> => {
    for (let i = 0; i < retries; i++) {
      const m = await api.getCurrentMerchant();
      if (m) return m;
      // Wait longer each retry — DB trigger may still be running
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
    return null;
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        setTimeout(async () => {
          const admin = await checkAdmin(session.user.id);
          if (admin) {
            setIsAdmin(true);
            setLoading(false);
            return;
          }
          const m = await loadMerchant();
          if (m) {
            setMerchant(m);
            setProfileError(false);
          } else {
            setProfileError(true);
          }
          setLoading(false);
        }, 0);
      } else {
        setMerchant(null);
        setProfileError(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setLoading(false);
      } else {
        loadMerchant().then(m => {
          if (m) {
            setMerchant(m);
          } else {
            setProfileError(true);
          }
          setLoading(false);
        });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Fix 3: show friendly message if profile failed to load
  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center glass rounded-2xl p-8 max-w-sm">
          <p className="text-lg font-semibold mb-2">Setting up your account...</p>
          <p className="text-sm text-muted-foreground mb-6">
            Your account is being set up. This usually takes a few seconds. Please try refreshing the page.
          </p>
          <button
            className="w-full py-2 px-4 rounded-lg gradient-primary text-primary-foreground font-medium"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
          <button
            className="w-full mt-3 py-2 px-4 rounded-lg border border-border text-sm text-muted-foreground"
            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin) return <Admin />;
  if (merchant) return <Dashboard initialMerchant={merchant} />;
  return <LandingPage />;
}
