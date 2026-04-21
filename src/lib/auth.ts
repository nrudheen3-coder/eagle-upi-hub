// Thin auth helpers around Supabase.
import { supabase } from "@/integrations/supabase/client";

export const auth = {
  async isLoggedIn(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },
  async logout() {
    await supabase.auth.signOut();
  },
};
