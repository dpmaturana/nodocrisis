

## Full Actor Network Migration

### Overview
Create the structural actor network tables and modify the existing `actor_capabilities` table to support organization-level capabilities with multiple users per organization. This is a single unified migration.

### Database Schema

```text
+------------------+        +------------------+        +-------------+
|     actors       |        |  actor_members   |        | auth.users  |
|------------------|        |------------------|        |-------------|
| id (PK)          |<-------| actor_id (FK)    |        | id (PK)     |
| organization_name|        | user_id (FK)     |------->|             |
| organization_type|        | role_in_org      |        +-------------+
| description      |        | created_at       |
| structural_status|        +------------------+
| created_by       |
| created_at       |
| updated_at       |
+------------------+
   |
   | actor_id (FK)
   |
   +---> actor_capabilities (existing, modified)
   |     - add actor_id (uuid, FK to actors)
   |     - add level (capability_level enum)
   |
   +---> actor_habitual_zones (new)
   |     - id, actor_id, region, commune, presence_type, created_at
   |
   +---> actor_contacts (new)
         - id, actor_id, name, role, email, phone, is_primary, created_at, updated_at
```

### 1. Database Migration

**New enum types:**
- `actor_type`: ong, state, private, volunteer
- `actor_structural_status`: active, inactive
- `capability_level`: basic, operational, specialized
- `presence_type`: habitual, occasional
- `actor_org_role`: admin, member

**New tables:**

| Table | Columns |
|---|---|
| `actors` | id, organization_name, organization_type (actor_type), description, structural_status, created_by (uuid nullable), created_at, updated_at |
| `actor_members` | id, actor_id (FK), user_id (FK to auth.users), role_in_org (actor_org_role), created_at |
| `actor_habitual_zones` | id, actor_id (FK), region (text), commune (text nullable), presence_type, created_at |
| `actor_contacts` | id, actor_id (FK), name (text), role (text nullable), email (text nullable), phone (text nullable), is_primary (boolean default false), created_at, updated_at |

**Modify existing table:**
- `actor_capabilities`: add `actor_id` (uuid, nullable, FK to actors) and `level` (capability_level, default 'operational')

**RLS policies (all tables):**
- Admins can manage everything (ALL using `has_role(auth.uid(), 'admin')`)
- Members can SELECT their own actor's data (via `actor_members` lookup)
- Members can INSERT/UPDATE/DELETE their own actor's data (via `actor_members` lookup)
- Authenticated users can SELECT actors (read-only public view of the network)

### 2. Seed Data

**Create two actor organizations:**

| | Cruz Roja Chile | Bomberos Sin Fronteras |
|---|---|---|
| Type | ong | ong |
| Status | active | active |
| Description | Emergency humanitarian response | Fire and rescue operations |

**Actor members:**
- ong@prueba.com -> Cruz Roja Chile (admin)
- myngo@ngo.com -> Bomberos Sin Fronteras (admin)

**Update existing actor_capabilities with actor_id and level:**
- Cruz Roja's existing capabilities (Emergency medical care, Food supply) get actor_id + level
- Bomberos' existing capability (Debris removal) gets actor_id + level

**Habitual zones:**

| | Cruz Roja Chile | Bomberos Sin Fronteras |
|---|---|---|
| Zone 1 | Metropolitana (habitual) | Biobio (habitual) |
| Zone 2 | Valparaiso (occasional) | La Araucania (occasional) |

**Contacts:**

| | Cruz Roja Chile | Bomberos Sin Fronteras |
|---|---|---|
| Primary | Maria Gonzalez, Coord. Emergencias, maria@cruzroja.cl, +56 9 1234 5678 | Carlos Fuentes, Jefe Operaciones, carlos@bsf.org, +56 9 8765 4321 |
| Secondary | Pedro Soto, Logistica, pedro@cruzroja.cl, +56 9 1111 2222 | Ana Morales, Enlace Institucional, ana@bsf.org, +56 9 3333 4444 |

### 3. Code Changes

**`src/types/database.ts`:**
- Remove `ActorCapabilityDeclared` type
- Add `level` field to `ActorCapability`
- Change `Actor.user_id` to `Actor.created_by`
- Add `ActorMember` type (id, actor_id, user_id, role_in_org, created_at)
- Update `ActorContact` to: name, role, email, phone, is_primary
- Update `ActorWithDetails` to use `ActorCapability[]` for capabilities

**`src/services/actorNetworkService.ts`:**
- Replace all `actor_capabilities_declared` references with `actor_capabilities` using `actor_id`
- Actor creation inserts creator into `actor_members` as admin
- `ContactInput` updated to name, role, email, phone, is_primary
- `getParticipationHistory` joins through `actor_members` to find deployments by any member
- Remove `as any` type casts where possible (tables now exist in schema)

**`src/components/actors/ContactsList.tsx`:**
- Display name, role (subtitle), phone, email instead of old channel fields

**`src/components/actors/ContactsForm.tsx`:**
- Four input fields: name, role, email, phone (replace primary_channel/secondary_channel)

**`src/components/actors/CapabilityDeclaredList.tsx`:**
- Rename/update to use `ActorCapability` type with `level` field

**`src/components/actors/CapabilityForm.tsx`:**
- Use `actor_capabilities` table, include `level` selector (basic/operational/specialized)

### 4. Sequence

1. Run database migration (create enums, tables, modify actor_capabilities, add RLS)
2. Seed data (actors, members, capability updates, zones, contacts)
3. Update `database.ts` types
4. Update `actorNetworkService.ts`
5. Update UI components (ContactsList, ContactsForm, CapabilityDeclaredList, CapabilityForm)

