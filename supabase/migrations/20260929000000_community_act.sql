-- Community Act roster: public signups shown on the ZYRAXON AI home page.
-- Writes go through the service-role API route; reads are open so the roster
-- marquee renders for anonymous visitors.

CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'Member',
  country text,
  skills text,
  consented_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_members_joined_at_idx
  ON public.community_members (joined_at DESC);

GRANT SELECT ON public.community_members TO anon;
GRANT SELECT ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors may read the roster, but never insert or update directly;
-- those operations only happen server-side with the service role key.
DROP POLICY IF EXISTS community_members_public_read ON public.community_members;
CREATE POLICY community_members_public_read ON public.community_members
  FOR SELECT USING (true);
