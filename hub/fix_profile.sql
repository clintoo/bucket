-- Insert profile for existing user
INSERT INTO public.profiles (id)
VALUES ('5b3c4be8-5d39-4193-9525-4432ab16c20a')
ON CONFLICT (id) DO NOTHING;

-- Verify the profile was created
SELECT * FROM public.profiles WHERE id = '5b3c4be8-5d39-4193-9525-4432ab16c20a';
