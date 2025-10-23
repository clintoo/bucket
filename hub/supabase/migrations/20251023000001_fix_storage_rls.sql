-- Fix storage RLS policy to allow repo owners to read their own objects
-- even if the repo is private

DROP POLICY IF EXISTS "Users can read objects from repos they have access to" ON storage.objects;

CREATE POLICY "Users can read objects from repos they have access to"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bit-objects' AND
  (storage.foldername(name))[1] = 'repos' AND
  EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id::text = (storage.foldername(name))[2]
    AND (repos.visibility = 'public' OR repos.owner_id = auth.uid())
  )
);
