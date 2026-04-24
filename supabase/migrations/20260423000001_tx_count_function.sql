-- Safe increment function for monthly_tx_count
CREATE OR REPLACE FUNCTION public.increment_merchant_tx_count(p_merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.merchants
  SET monthly_tx_count = COALESCE(monthly_tx_count, 0) + 1
  WHERE id = p_merchant_id;
END;
$$;
