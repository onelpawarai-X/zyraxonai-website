-- GitHub account connection storage for ZYRAXON AI.
-- Tokens are encrypted by the application before persistence.
CREATE TABLE IF NOT EXISTS public.github_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id BIGINT NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  refresh_token_encrypted TEXT,
  refresh_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;

CREATE POLICY "github_connections_read_own"
  ON public.github_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_github_connection()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS github_connections_updated_at ON public.github_connections;
CREATE TRIGGER github_connections_updated_at
  BEFORE UPDATE ON public.github_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_github_connection();

CREATE INDEX IF NOT EXISTS idx_github_connections_login
  ON public.github_connections(github_login);
