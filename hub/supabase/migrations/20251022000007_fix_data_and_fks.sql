-- Step 1: Create missing profiles for any users that have repos but no profile
INSERT INTO public.profiles (id, username, created_at, updated_at)
SELECT DISTINCT 
  r.owner_id,
  COALESCE(
    u.raw_user_meta_data->>'username',
    split_part(u.email, '@', 1) || '_' || substr(r.owner_id::text, 1, 8)
  ) as username,
  now(),
  now()
FROM public.repos r
LEFT JOIN public.profiles p ON r.owner_id = p.id
JOIN auth.users u ON r.owner_id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop old 'repositories' table if it exists
DROP TABLE IF EXISTS public.repositories CASCADE;

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
