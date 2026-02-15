-- Country-specific list of trusted news RSS feeds

create table if not exists public.country_news_sources (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  source_name text not null,
  rss_url text not null,
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(country_code, source_name)
);

alter table public.country_news_sources enable row level security;

-- Authenticated users can read sources (needed for UI display)
create policy "Authenticated can view country news sources"
on public.country_news_sources
for select
to authenticated
using (true);

-- Only admins can insert/update/delete (manage sources)
create policy "Admins can manage country news sources"
on public.country_news_sources
for all
using (public.has_role(auth.uid(), 'admin'));

-- Seed Spain (ES) with 5 starter sources
insert into public.country_news_sources (country_code, source_name, rss_url, enabled)
values
  ('ES', 'El País', 'https://elpais.com/rss/elpais/portada.xml', true),
  ('ES', 'RTVE', 'https://www.rtve.es/rss/temas_noticias.xml', true),
  ('ES', 'Europa Press', 'https://www.europapress.es/rss/rss.aspx', true),
  ('ES', 'BBC', 'https://feeds.bbci.co.uk/news/rss.xml?edition=int', true),
  ('ES', 'The Guardian', 'https://www.theguardian.com/world/rss', true)
on conflict (country_code, source_name) do nothing;