import { useEffect, useState } from "react";
import LandingPage from "@/components/LandingPage";
import Dashboard from "@/components/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { api, Merchant } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  useEffect(() => {
    // Subscribe to auth changes; load merchant when signed in
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) {
        // Defer to avoid deadlock per Supabase guidance
        setTimeout(() => {
          api.getCurrentMerchant().then(m => setMerchant(m)).finally(() => setLoading(false));
        }, 0);
      } else {
        setMerchant(null);
        setLoading(false);
      }
    });

    // Initial check
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setLoading(false);
      } else {
        api.getCurrentMerchant().then(m => {
          setMerchant(m);
          setLoading(false);
        });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (merchant) return <Dashboard initialMerchant={merchant} />;
  return <LandingPage />;
}
