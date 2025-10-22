-- Fix stars table foreign key to reference repos instead of repositories
ALTER TABLE public.stars DROP CONSTRAINT IF EXISTS stars_repo_id_fkey;
ALTER TABLE public.stars ADD CONSTRAINT stars_repo_id_fkey FOREIGN KEY (repo_id) REFERENCES public.repos(id) ON DELETE CASCADE;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
