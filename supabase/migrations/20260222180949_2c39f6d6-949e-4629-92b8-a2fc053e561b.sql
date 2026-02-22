
-- Fix the signup trigger to save full_name and organization_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, organization_name)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'organization_name'
    );
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'actor');
    RETURN NEW;
END;
$$;

-- Backfill existing profiles from auth metadata
UPDATE profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name'),
  organization_name = COALESCE(p.organization_name, u.raw_user_meta_data->>'organization_name')
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.full_name IS NULL OR p.organization_name IS NULL);
