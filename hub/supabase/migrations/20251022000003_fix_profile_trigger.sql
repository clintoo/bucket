-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_username TEXT;
BEGIN
  -- Get username from metadata, or generate one from email if not provided
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 8)
  );

  -- Insert the new profile
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    avatar_url
  )
  VALUES (
    NEW.id,
    new_username,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If username is taken, append random characters
    INSERT INTO public.profiles (
      id,
      username,
      full_name,
      avatar_url
    )
    VALUES (
      NEW.id,
      split_part(NEW.email, '@', 1) || '_' || substr(md5(random()::text), 1, 8),
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
