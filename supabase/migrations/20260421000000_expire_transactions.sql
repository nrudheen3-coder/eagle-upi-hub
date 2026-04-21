-- Fix 7: Auto-expire transactions past their expires_at timestamp
-- Uses pg_cron to run every minute

-- Enable pg_cron extension (already available on Supabase)
create extension if not exists pg_cron;

-- Function to expire overdue transactions
create or replace function public.expire_overdue_transactions()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.transactions
  set status = 'expired', updated_at = now()
  where status in ('pending_payment', 'pending_utr')
    and expires_at < now();
end;
$$;

-- Schedule: run every minute
select cron.schedule(
  'expire-transactions',
  '* * * * *',
  $$ select public.expire_overdue_transactions(); $$
);
