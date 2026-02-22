create table if not exists ingested_news_items (
  id           bigserial primary key,
  ingested_at  timestamptz not null default now(),
  country_code varchar(8)  not null,
  source_name  text,
  title        text        not null,
  url          text,
  published_at text,
  snippet      text,
  raw          jsonb
);

create index on ingested_news_items (country_code, ingested_at desc);
create index on ingested_news_items (url) where url is not null;
