-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'merchant');
CREATE TYPE public.txn_status AS ENUM ('pending_payment', 'pending_utr', 'submitted', 'verified', 'expired', 'failed');

-- ============ TIMESTAMP TRIGGER FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ MERCHANTS ============
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE DEFAULT ('ek_live_' || replace(gen_random_uuid()::text, '-', '')),
  webhook_url TEXT,
  match_window_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX idx_merchants_api_key ON public.merchants(api_key);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own profile" ON public.merchants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Merchants update own profile" ON public.merchants
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Merchants insert own profile" ON public.merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_merchants_updated
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VPAS ============
CREATE TABLE public.vpas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  vpa TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, vpa)
);
CREATE INDEX idx_vpas_merchant_id ON public.vpas(merchant_id);
CREATE INDEX idx_vpas_active ON public.vpas(merchant_id, is_active) WHERE is_active = true;

ALTER TABLE public.vpas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own vpas" ON public.vpas
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL UNIQUE DEFAULT ('INV_' || replace(gen_random_uuid()::text, '-', '')),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  utr TEXT,
  status public.txn_status NOT NULL DEFAULT 'pending_payment',
  payer_vpa TEXT,
  customer_name TEXT,
  matched_via TEXT, -- 'manual_utr' | 'notification_listener' | 'admin'
  matched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_merchant_status ON public.transactions(merchant_id, status, created_at DESC);
CREATE INDEX idx_txn_utr ON public.transactions(utr) WHERE utr IS NOT NULL;
CREATE INDEX idx_txn_pending_match ON public.transactions(merchant_id, amount, status)
  WHERE status IN ('pending_payment', 'pending_utr');

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own transactions" ON public.transactions
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );
CREATE POLICY "Merchants update own transactions" ON public.transactions
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_txn_updated
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LISTENER DEVICES ============
CREATE TABLE public.listener_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_token TEXT NOT NULL UNIQUE DEFAULT ('dvc_' || replace(gen_random_uuid()::text, '-', '')),
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_merchant ON public.listener_devices(merchant_id);
CREATE INDEX idx_devices_token ON public.listener_devices(device_token);

ALTER TABLE public.listener_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own devices" ON public.listener_devices
  FOR ALL USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- ============ USER ROLES (for admin) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE MERCHANT ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_merchant_id UUID;
  default_vpa TEXT;
  default_name TEXT;
BEGIN
  default_name := COALESCE(NEW.raw_user_meta_data->>'business_name', split_part(NEW.email, '@', 1) || '''s Store');
  default_vpa := COALESCE(NEW.raw_user_meta_data->>'vpa', split_part(NEW.email, '@', 1) || '@upi');

  INSERT INTO public.merchants (user_id, business_name)
  VALUES (NEW.id, default_name)
  RETURNING id INTO new_merchant_id;

  INSERT INTO public.vpas (merchant_id, vpa, is_active)
  VALUES (new_merchant_id, default_vpa, true);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'merchant');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PUBLIC LOOKUP FOR /pay PAGE (no auth) ============
-- Returns active VPA + business name for a merchant_id (used by hosted payment page)
CREATE OR REPLACE FUNCTION public.get_merchant_payment_info(_merchant_id UUID)
RETURNS TABLE (business_name TEXT, vpa TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.business_name, v.vpa
  FROM public.merchants m
  LEFT JOIN public.vpas v ON v.merchant_id = m.id AND v.is_active = true
  WHERE m.id = _merchant_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_payment_info(UUID) TO anon, authenticated;