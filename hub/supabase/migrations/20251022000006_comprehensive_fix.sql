-- Comprehensive fix for all table relationships

-- Step 1: Check if old 'repositories' table exists and drop it if so
DROP TABLE IF EXISTS public.repositories CASCADE;

-- Step 2: Ensure repos table has correct structure
-- (This is idempotent - won't fail if already correct)

-- Step 3: Fix all foreign keys
-- Fix repos -> profiles
ALTER TABLE public.repos DROP CONSTRAINT IF EXISTS repos_owner_id_fkey;
ALTER TABLE public.repos ADD CONSTRAINT repos_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix stars -> repos
ALTER TABLE public.stars DROP CONSTRAINT IF EXISTS stars_repo_id_fkey;
ALTER TABLE public.stars ADD CONSTRAINT stars_repo_id_fkey 
  FOREIGN KEY (repo_id) REFERENCES public.repos(id) ON DELETE CASCADE;

-- Fix files -> repos (if files table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files' AND table_schema = 'public') THEN
    ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_repo_id_fkey;
    ALTER TABLE public.files ADD CONSTRAINT files_repo_id_fkey 
      FOREIGN KEY (repo_id) REFERENCES public.repos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Reload PostgREST schema cache to recognize all relationships
NOTIFY pgrst, 'reload schema';
