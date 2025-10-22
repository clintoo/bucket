-- Create profiles table to store additional user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies: anyone can view, users can update their own
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create repositories table
CREATE TABLE IF NOT EXISTS public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  branch TEXT DEFAULT 'main',
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS on repositories
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

-- Repository policies: public read, owner write
CREATE POLICY "Public read access for repositories"
  ON public.repositories FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own repositories"
  ON public.repositories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own repositories"
  ON public.repositories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own repositories"
  ON public.repositories FOR DELETE
  USING (auth.uid() = user_id);

-- Create files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT,
  is_binary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repo_id, path)
);

-- Enable RLS on files
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Files policies: public read, owner write
CREATE POLICY "Public read access for files"
  ON public.files FOR SELECT
  USING (true);

CREATE POLICY "Users can insert files in own repos"
  ON public.files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.repositories
      WHERE repositories.id = files.repo_id
      AND repositories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update files in own repos"
  ON public.files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories
      WHERE repositories.id = files.repo_id
      AND repositories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files in own repos"
  ON public.files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.repositories
      WHERE repositories.id = files.repo_id
      AND repositories.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on repositories
CREATE TRIGGER update_repositories_updated_at
  BEFORE UPDATE ON public.repositories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();