
-- 1. Create enum types
CREATE TYPE public.actor_type AS ENUM ('ong', 'state', 'private', 'volunteer');
CREATE TYPE public.actor_structural_status AS ENUM ('active', 'inactive');
CREATE TYPE public.capability_level AS ENUM ('basic', 'operational', 'specialized');
CREATE TYPE public.presence_type AS ENUM ('habitual', 'occasional');
CREATE TYPE public.actor_org_role AS ENUM ('admin', 'member');

-- 2. Create actors table
CREATE TABLE public.actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  organization_type public.actor_type NOT NULL DEFAULT 'ong',
  description text,
  structural_status public.actor_structural_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_actors_updated_at
  BEFORE UPDATE ON public.actors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create actor_members table
CREATE TABLE public.actor_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_org public.actor_org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, user_id)
);
ALTER TABLE public.actor_members ENABLE ROW LEVEL SECURITY;

-- 4. Create actor_habitual_zones table
CREATE TABLE public.actor_habitual_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  region text NOT NULL,
  commune text,
  presence_type public.presence_type NOT NULL DEFAULT 'habitual',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.actor_habitual_zones ENABLE ROW LEVEL SECURITY;

-- 5. Create actor_contacts table
CREATE TABLE public.actor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.actor_contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_actor_contacts_updated_at
  BEFORE UPDATE ON public.actor_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Modify actor_capabilities: add actor_id and level
ALTER TABLE public.actor_capabilities
  ADD COLUMN actor_id uuid REFERENCES public.actors(id) ON DELETE SET NULL,
  ADD COLUMN level public.capability_level NOT NULL DEFAULT 'operational';

-- 7. RLS policies for actors
CREATE POLICY "Admins can manage actors" ON public.actors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view actors" ON public.actors FOR SELECT
  USING (true);
CREATE POLICY "Members can manage their own actor" ON public.actors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.actor_members am WHERE am.actor_id = actors.id AND am.user_id = auth.uid()
  ));

-- 8. RLS policies for actor_members
CREATE POLICY "Admins can manage actor_members" ON public.actor_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view actor_members" ON public.actor_members FOR SELECT
  USING (true);

-- 9. RLS policies for actor_habitual_zones
CREATE POLICY "Admins can manage actor_habitual_zones" ON public.actor_habitual_zones FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view actor_habitual_zones" ON public.actor_habitual_zones FOR SELECT
  USING (true);
CREATE POLICY "Members can manage their actor zones" ON public.actor_habitual_zones FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.actor_members am WHERE am.actor_id = actor_habitual_zones.actor_id AND am.user_id = auth.uid()
  ));

-- 10. RLS policies for actor_contacts
CREATE POLICY "Admins can manage actor_contacts" ON public.actor_contacts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view actor_contacts" ON public.actor_contacts FOR SELECT
  USING (true);
CREATE POLICY "Members can manage their actor contacts" ON public.actor_contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.actor_members am WHERE am.actor_id = actor_contacts.actor_id AND am.user_id = auth.uid()
  ));
