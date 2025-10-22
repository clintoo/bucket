-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true);

-- Create storage bucket for repository files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repo-files', 'repo-files', true);

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for repository files
CREATE POLICY "Repository files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'repo-files');

CREATE POLICY "Users can upload files to own repos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'repo-files' 
  AND EXISTS (
    SELECT 1 FROM repositories 
    WHERE repositories.id::text = (storage.foldername(name))[1]
    AND repositories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update files in own repos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'repo-files' 
  AND EXISTS (
    SELECT 1 FROM repositories 
    WHERE repositories.id::text = (storage.foldername(name))[1]
    AND repositories.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete files in own repos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'repo-files' 
  AND EXISTS (
    SELECT 1 FROM repositories 
    WHERE repositories.id::text = (storage.foldername(name))[1]
    AND repositories.user_id = auth.uid()
  )
);

-- Add storage_path column to files table for binary files
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Create stars table for repository starring
CREATE TABLE IF NOT EXISTS stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

-- Enable RLS on stars table
ALTER TABLE stars ENABLE ROW LEVEL SECURITY;

-- RLS policies for stars
CREATE POLICY "Public read access for stars" 
ON stars 
FOR SELECT 
USING (true);

CREATE POLICY "Users can star repositories" 
ON stars 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unstar repositories" 
ON stars 
FOR DELETE 
USING (auth.uid() = user_id);