-- Persistent ZYRAXON Builder projects / ecosystem marketplace.
CREATE TABLE IF NOT EXISTS public.builder_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled website',
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  files JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_html TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT true,
  repo_url TEXT,
  pages_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE public.builder_sites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_sites TO authenticated;
GRANT ALL ON public.builder_sites TO service_role;

CREATE POLICY "builder_sites_read_public_or_own" ON public.builder_sites FOR SELECT TO authenticated
USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "builder_sites_insert_own" ON public.builder_sites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "builder_sites_update_own" ON public.builder_sites FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "builder_sites_delete_own" ON public.builder_sites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_builder_sites_public_updated ON public.builder_sites(is_public, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_sites_user_updated ON public.builder_sites(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_builder_site()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS builder_sites_updated_at ON public.builder_sites;
CREATE TRIGGER builder_sites_updated_at BEFORE UPDATE ON public.builder_sites
FOR EACH ROW EXECUTE FUNCTION public.touch_builder_site();
