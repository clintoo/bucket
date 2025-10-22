-- Create repos table
CREATE TABLE IF NOT EXISTS public.repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')) DEFAULT 'private',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);

-- Create refs table
CREATE TABLE IF NOT EXISTS public.refs (
  repo_id UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hash TEXT NOT NULL CHECK (hash ~ '^[0-9a-f]{40}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (repo_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_repos_owner ON public.repos(owner_id);
CREATE INDEX IF NOT EXISTS idx_repos_visibility ON public.repos(visibility);
CREATE INDEX IF NOT EXISTS idx_refs_repo ON public.refs(repo_id);

-- Enable RLS
ALTER TABLE public.repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for repos
-- Anyone can view public repos or their own repos
CREATE POLICY "repos_select_policy" ON public.repos
  FOR SELECT
  USING (
    visibility = 'public' OR owner_id = auth.uid()
  );

-- Users can insert their own repos
CREATE POLICY "repos_insert_policy" ON public.repos
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own repos
CREATE POLICY "repos_update_policy" ON public.repos
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own repos
CREATE POLICY "repos_delete_policy" ON public.repos
  FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for refs
-- Anyone can view refs if they can view the repo
CREATE POLICY "refs_select_policy" ON public.refs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.repos
      WHERE repos.id = refs.repo_id
      AND (repos.visibility = 'public' OR repos.owner_id = auth.uid())
    )
  );

-- Users can insert refs only for repos they own
CREATE POLICY "refs_insert_policy" ON public.refs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repos
      WHERE repos.id = refs.repo_id
      AND repos.owner_id = auth.uid()
    )
  );

-- Users can update refs only for repos they own
CREATE POLICY "refs_update_policy" ON public.refs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.repos
      WHERE repos.id = refs.repo_id
      AND repos.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repos
      WHERE repos.id = refs.repo_id
      AND repos.owner_id = auth.uid()
    )
  );

-- Users can delete refs only for repos they own
CREATE POLICY "refs_delete_policy" ON public.refs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.repos
      WHERE repos.id = refs.repo_id
      AND repos.owner_id = auth.uid()
    )
  );

-- Add updated_at trigger for repos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_repos_updated_at
  BEFORE UPDATE ON public.repos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
