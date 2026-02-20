

# Migrate Actor Network Service to Real Database

## Problem
The `actorNetworkService.ts` is entirely mock-based. All CRUD operations write to in-memory arrays that:
- Don't persist (lost on page refresh)
- Use fake IDs that don't match real DB records
- Never touch any real database tables

## Solution
1. Create database migration for actor network tables (`actors`, `actor_capabilities_declared`, `actor_habitual_zones`, `actor_contacts`)
2. Update Supabase auto-generated types to include the new tables
3. Rewrite `actorNetworkService.ts` to use real Supabase queries while keeping the same public API

## Changes

### 1. Database Migration
New migration: `supabase/migrations/20260220120000_create_actor_network_tables.sql`
- Creates enum types: `actor_type`, `actor_structural_status`, `capability_level`, `presence_type`
- Creates tables: `actors`, `actor_capabilities_declared`, `actor_habitual_zones`, `actor_contacts`
- Adds RLS policies: authenticated read, owner manage, admin manage all
- Adds indexes for foreign keys and common query patterns

### 2. Supabase Types Update
Updated `src/integrations/supabase/types.ts`:
- Added table definitions for all four new tables
- Added enum types for `actor_type`, `actor_structural_status`, `capability_level`, `presence_type`

### 3. Service Rewrite
Rewrote `src/services/actorNetworkService.ts`:
- All operations now use `supabase` client instead of in-memory arrays
- `buildActorWithDetails` fetches related data from DB
- `getParticipationHistory` derives from real deployments table
- `getCapacityTypes` queries real `capacity_types` table
- No mock imports remain

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260220120000_create_actor_network_tables.sql` | New migration |
| `src/integrations/supabase/types.ts` | Added 4 table types + 4 enum types |
| `src/services/actorNetworkService.ts` | Full rewrite from mock to real DB |

