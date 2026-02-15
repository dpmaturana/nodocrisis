
# Migration: Country News Sources & Ingested News Items

## Overview
Create the two database tables that `collect-news-context` already references but don't yet exist, so the function stops falling back silently and can persist feeds + results.

## Tables to Create

### 1. `country_news_sources`
Stores RSS feed URLs per country so the edge function can load them dynamically instead of relying on hardcoded defaults.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| country_code | text NOT NULL | ISO 2-letter code (e.g. "ES", "CL") |
| source_name | text NOT NULL | Display name (e.g. "El Pais") |
| rss_url | text NOT NULL | RSS feed URL |
| enabled | boolean NOT NULL | default true |
| created_at | timestamptz | default now() |

Indexes: composite on (country_code, enabled) for the query the function runs.

### 2. `ingested_news_items`
Stores scored news snippets returned by the function for auditing / later reuse.

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| country_code | text NOT NULL | |
| source_name | text NOT NULL | |
| title | text NOT NULL | |
| url | text | nullable |
| published_at | text | nullable (raw from RSS) |
| snippet | text | nullable |
| raw | jsonb | full item blob |
| created_at | timestamptz | default now() |

### 3. RLS Policies
- Both tables: **admins full access** (ALL) via `has_role(auth.uid(), 'admin')`.
- `country_news_sources`: authenticated users can SELECT (feeds are not secret).
- `ingested_news_items`: authenticated users can SELECT.

### 4. Seed Data
Insert the 5 default ES feeds currently hardcoded in the edge function so they're managed from the database going forward.

## Technical Details

Single migration file with:
1. `CREATE TABLE country_news_sources` + index
2. `CREATE TABLE ingested_news_items`
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on both
4. RLS policies (admin ALL + authenticated SELECT)
5. `INSERT INTO country_news_sources` the 5 default ES feeds
