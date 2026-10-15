-- Community profile upgrades + removal of the SWE-bench report table.
--
-- 1. community_members gains an avatar and an explicit list of public links.
-- 2. A public storage bucket holds the uploaded profile pictures; uploads are
--    performed server-side with the service role, so only read access is granted.
-- 3. The swebench_report table is dropped: the benchmark claim is not part of
--    the product and the public pages that used it have been removed.

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS links text;

DROP TABLE IF EXISTS public.swebench_report;

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-avatars', 'community-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS community_avatars_public_read ON storage.objects;
CREATE POLICY community_avatars_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'community-avatars');

