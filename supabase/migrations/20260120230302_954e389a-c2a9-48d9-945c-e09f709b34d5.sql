-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'actor');

-- Create enum for need level
CREATE TYPE public.need_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Create enum for deployment status
CREATE TYPE public.deployment_status AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- Create enum for availability
CREATE TYPE public.availability_status AS ENUM ('ready', 'limited', 'unavailable');

-- Create enum for sector resolution status
CREATE TYPE public.sector_status AS ENUM ('unresolved', 'tentative', 'resolved');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT,
    full_name TEXT,
    organization_name TEXT,
    organization_type TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Create events table (emergency events)
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create capacity types table
CREATE TABLE public.capacity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default capacity types
INSERT INTO public.capacity_types (name, description, icon) VALUES
    ('agua', 'Suministro de agua potable', 'droplet'),
    ('alimentos', 'Distribución de alimentos', 'utensils'),
    ('salud', 'Atención médica y primeros auxilios', 'heart-pulse'),
    ('rescate', 'Operaciones de búsqueda y rescate', 'life-buoy'),
    ('albergue', 'Refugio y hospedaje temporal', 'home'),
    ('logistica', 'Transporte y distribución', 'truck'),
    ('energia', 'Generadores y suministro eléctrico', 'zap'),
    ('comunicaciones', 'Equipos de comunicación', 'radio');

-- Create sectors table (dynamic operational sectors)
CREATE TABLE public.sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    canonical_name TEXT NOT NULL,
    aliases TEXT[],
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    status sector_status NOT NULL DEFAULT 'unresolved',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(event_id, canonical_name)
);

-- Create sector_needs_sms table (citizen demand via SMS)
CREATE TABLE public.sector_needs_sms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE NOT NULL,
    capacity_type_id UUID REFERENCES public.capacity_types(id) NOT NULL,
    level need_level NOT NULL DEFAULT 'medium',
    count INTEGER NOT NULL DEFAULT 1,
    evidence_text TEXT,
    confidence_score DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sector_needs_context table (admin/coordination demand)
CREATE TABLE public.sector_needs_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE NOT NULL,
    capacity_type_id UUID REFERENCES public.capacity_types(id) NOT NULL,
    level need_level NOT NULL DEFAULT 'medium',
    source TEXT NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create actor_capabilities table (what each org can provide)
CREATE TABLE public.actor_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    capacity_type_id UUID REFERENCES public.capacity_types(id) NOT NULL,
    quantity INTEGER,
    unit TEXT,
    availability availability_status NOT NULL DEFAULT 'ready',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, capacity_type_id)
);

-- Create deployments table (actor assignments to sectors)
CREATE TABLE public.deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE CASCADE NOT NULL,
    capacity_type_id UUID REFERENCES public.capacity_types(id) NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status deployment_status NOT NULL DEFAULT 'planned',
    notes TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(event_id, sector_id, capacity_type_id, actor_id)
);

-- Create sms_messages table (raw SMS ingestion)
CREATE TABLE public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    message_text TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed BOOLEAN DEFAULT FALSE,
    extracted_need_type TEXT,
    extracted_places TEXT[],
    confidence_score DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_needs_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_needs_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actor_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for events
CREATE POLICY "Anyone authenticated can view events"
    ON public.events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage events"
    ON public.events FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for capacity_types (public read)
CREATE POLICY "Anyone can view capacity types"
    ON public.capacity_types FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policies for sectors
CREATE POLICY "Anyone authenticated can view sectors"
    ON public.sectors FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage sectors"
    ON public.sectors FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sector_needs_sms
CREATE POLICY "Anyone authenticated can view SMS needs"
    ON public.sector_needs_sms FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage SMS needs"
    ON public.sector_needs_sms FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sector_needs_context
CREATE POLICY "Anyone authenticated can view context needs"
    ON public.sector_needs_context FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage context needs"
    ON public.sector_needs_context FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for actor_capabilities
CREATE POLICY "Users can view their own capabilities"
    ON public.actor_capabilities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own capabilities"
    ON public.actor_capabilities FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all capabilities"
    ON public.actor_capabilities FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for deployments
CREATE POLICY "Anyone authenticated can view deployments"
    ON public.deployments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can manage their own deployments"
    ON public.deployments FOR ALL
    USING (auth.uid() = actor_id);

CREATE POLICY "Admins can manage all deployments"
    ON public.deployments FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sms_messages
CREATE POLICY "Admins can manage SMS messages"
    ON public.sms_messages FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sectors_updated_at
    BEFORE UPDATE ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_actor_capabilities_updated_at
    BEFORE UPDATE ON public.actor_capabilities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at
    BEFORE UPDATE ON public.deployments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    -- By default, new users are actors
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'actor');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();