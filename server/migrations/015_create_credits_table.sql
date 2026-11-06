-- =============================================
-- 015_create_credits_table.sql
-- =============================================
-- Mirror `credits` table kept in sync with users.credits (ledger source of
-- truth in deduct_credits/refund_credits RPCs). Read path stays on users.credits.

CREATE TABLE IF NOT EXISTS public.credits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  available_credits integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credits_updated_at_idx ON public.credits (updated_at);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Server keeps its PostgREST surface minimal: only service_role touches this
-- mirror (same pattern as the ledger RPC lockdown in 002).
REVOKE ALL ON public.credits FROM anon, authenticated;
GRANT ALL ON public.credits TO service_role;

-- Mirror sync: INSERT row when a user is created, UPDATE when users.credits changes.
CREATE OR REPLACE FUNCTION public.sync_credits_from_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.credits (user_id, available_credits)
  VALUES (NEW.id, NEW.credits)
  ON CONFLICT (user_id)
  DO UPDATE SET available_credits = EXCLUDED.available_credits,
                updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credits_sync_from_users ON public.users;
CREATE TRIGGER credits_sync_from_users
  AFTER INSERT OR UPDATE OF credits ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_credits_from_users();

-- Backfill existing users that predate the trigger.
INSERT INTO public.credits (user_id, available_credits)
SELECT id, credits FROM public.users
ON CONFLICT (user_id) DO NOTHING;
