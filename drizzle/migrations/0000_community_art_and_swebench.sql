CREATE TABLE IF NOT EXISTS public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'Member',
  country text,
  skills text,
  participation text,
  address text,
  phone text,
  social_links text,
  institution text,
  email_verified boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.swebench_report (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT 'ZYRAXON AI — SWE-bench Verified',
  score text,
  authors text,
  contribution text,
  methodology text,
  first_run text,
  rerun text,
  code_url text,
  results_url text,
  report_url text,
  download_url text,
  links_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.swebench_report TO service_role;
ALTER TABLE public.swebench_report ENABLE ROW LEVEL SECURITY;
INSERT INTO public.swebench_report (id) VALUES (1) ON CONFLICT DO NOTHING;