-- Actor Network structural tables
-- These tables store persistent organizational profiles, declared capabilities,
-- geographic zones, and contact info — separate from per-event operational data.

-- ============== ENUM TYPES ==============

CREATE TYPE public.actor_type AS ENUM ('ong', 'state', 'private', 'volunteer');
CREATE TYPE public.actor_structural_status AS ENUM ('active', 'inactive');
CREATE TYPE public.capability_level AS ENUM ('basic', 'operational', 'specialized');
CREATE TYPE public.presence_type AS ENUM ('habitual', 'occasional');

-- ============== ACTORS TABLE ==============

CREATE TABLE public.actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    organization_type public.actor_type NOT NULL DEFAULT 'ong',
    description TEXT,
    structural_status public.actor_structural_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all actors"
    ON public.actors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage their own actor profile"
    ON public.actors FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all actors"
    ON public.actors FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============== ACTOR CAPABILITIES DECLARED ==============

CREATE TABLE public.actor_capabilities_declared (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
    capacity_type_id UUID NOT NULL REFERENCES public.capacity_types(id) ON DELETE CASCADE,
    level public.capability_level NOT NULL DEFAULT 'basic',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(actor_id, capacity_type_id)
);

ALTER TABLE public.actor_capabilities_declared ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all declared capabilities"
    ON public.actor_capabilities_declared FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Actor owners can manage their declared capabilities"
    ON public.actor_capabilities_declared FOR ALL
    USING (
        actor_id IN (SELECT id FROM public.actors WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage all declared capabilities"
    ON public.actor_capabilities_declared FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============== ACTOR HABITUAL ZONES ==============

CREATE TABLE public.actor_habitual_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
    region TEXT NOT NULL,
    commune TEXT,
    presence_type public.presence_type NOT NULL DEFAULT 'habitual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.actor_habitual_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all habitual zones"
    ON public.actor_habitual_zones FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Actor owners can manage their habitual zones"
    ON public.actor_habitual_zones FOR ALL
    USING (
        actor_id IN (SELECT id FROM public.actors WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage all habitual zones"
    ON public.actor_habitual_zones FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============== ACTOR CONTACTS ==============

CREATE TABLE public.actor_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    primary_channel TEXT NOT NULL,
    secondary_channel TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.actor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all contacts"
    ON public.actor_contacts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Actor owners can manage their contacts"
    ON public.actor_contacts FOR ALL
    USING (
        actor_id IN (SELECT id FROM public.actors WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage all contacts"
    ON public.actor_contacts FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ============== INDEXES ==============

CREATE INDEX idx_actors_user_id ON public.actors(user_id);
CREATE INDEX idx_actors_structural_status ON public.actors(structural_status);
CREATE INDEX idx_actors_organization_type ON public.actors(organization_type);
CREATE INDEX idx_actor_capabilities_declared_actor_id ON public.actor_capabilities_declared(actor_id);
CREATE INDEX idx_actor_capabilities_declared_capacity_type_id ON public.actor_capabilities_declared(capacity_type_id);
CREATE INDEX idx_actor_habitual_zones_actor_id ON public.actor_habitual_zones(actor_id);
CREATE INDEX idx_actor_habitual_zones_region ON public.actor_habitual_zones(region);
CREATE INDEX idx_actor_contacts_actor_id ON public.actor_contacts(actor_id);
