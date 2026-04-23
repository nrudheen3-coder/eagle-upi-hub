ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_tx_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_tx_reset_at TIMESTAMPTZ DEFAULT now();

CREATE POLICY "Admins view all merchants" ON public.merchants
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all merchants" ON public.merchants
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all transactions" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all devices" ON public.listener_devices
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
