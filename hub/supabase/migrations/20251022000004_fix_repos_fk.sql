-- Remove old foreign key if exists
ALTER TABLE public.repos DROP CONSTRAINT IF EXISTS repos_owner_id_fkey;

-- Add correct foreign key to profiles(id)
ALTER TABLE public.repos ADD CONSTRAINT repos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Reload PostgREST schema cache to recognize the new relationship
NOTIFY pgrst, 'reload schema';
