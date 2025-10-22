-- Create storage bucket for bit objects
INSERT INTO storage.buckets (id, name, public)
VALUES ('bit-objects', 'bit-objects', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for bit-objects bucket
CREATE POLICY "Users can upload to their own repos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bit-objects' AND
  (storage.foldername(name))[1] = 'repos' AND
  EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id::text = (storage.foldername(name))[2]
    AND repos.owner_id = auth.uid()
  )
);

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

CREATE POLICY "Users can update objects in their own repos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'bit-objects' AND
  (storage.foldername(name))[1] = 'repos' AND
  EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id::text = (storage.foldername(name))[2]
    AND repos.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete objects from their own repos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bit-objects' AND
  (storage.foldername(name))[1] = 'repos' AND
  EXISTS (
    SELECT 1 FROM public.repos
    WHERE repos.id::text = (storage.foldername(name))[2]
    AND repos.owner_id = auth.uid()
  )
);
