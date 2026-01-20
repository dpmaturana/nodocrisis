-- Agregar rol admin al usuario existente (mantiene rol actor también)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles
WHERE email = 'dmaturanamartinez@gmail.com'
ON CONFLICT DO NOTHING;