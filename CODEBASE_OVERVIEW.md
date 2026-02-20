# NodoCrisis — Codebase Overview & Architecture

## What Is NodoCrisis?

**NodoCrisis** is an **Emergency Coordination & Gap Management Platform** designed for disaster response in Chile. It enables multiple types of actors (government, NGOs, private sector, volunteers) to coordinate humanitarian responses by tracking **what is needed**, **what is covered**, and **where the gaps are** — in real time.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Event** | A disaster or emergency (e.g., Valparaíso wildfire, flood) |
| **Sector** | A geographic sub-area within an event (e.g., a neighborhood or commune) |
| **Capacity Type** | A type of capability needed (e.g., shelter, water, medical, logistics) |
| **Gap** | An unmet need: a sector requires a capacity type that no actor is covering |
| **Deployment** | An actor assigned to provide a specific capacity in a specific sector |
| **Signal** | Evidence of need from various sources (SMS, tweets, news, field reports) |
| **Actor** | An organization or volunteer that can provide capabilities |

### Two User Roles

1. **Admin** — Creates emergencies, monitors gaps by sector, coordinates multi-actor deployments, generates AI-assisted situation reports.
2. **Actor (ONG/Volunteer)** — Declares their capabilities, browses events/sectors, enrolls in operations, reports field status.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript 5, Vite 5 (SWC), TailwindCSS 3 + shadcn/ui (Radix) |
| **Routing** | React Router v6 (SPA) |
| **State** | TanStack React Query 5 (server state), React Context (auth) |
| **Forms** | React Hook Form + Zod validation |
| **Maps** | Leaflet + React Leaflet |
| **Charts** | Recharts |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| **AI** | Claude API via Supabase Edge Functions (Deno) |
| **Testing** | Vitest (unit), Testing Library (component), Playwright (E2E) |

---

## Project Structure

```
src/
├── pages/                     # Route-level page components
│   ├── Dashboard.tsx          # Actor: stats, events, deployments overview
│   ├── Events.tsx             # Actor: browse all events
│   ├── EventDetail.tsx        # Actor: single event details
│   ├── NewEvent.tsx           # Actor: manual event creation
│   ├── Sectors.tsx            # Actor: browse sectors
│   ├── MyCapabilities.tsx     # Actor: declare/manage capabilities
│   ├── MyDeployments.tsx      # Actor: view active deployments
│   ├── Auth.tsx               # Login/signup
│   └── admin/
│       ├── EventDashboard.tsx # Admin: real-time gap monitoring + map
│       ├── CreateEventAI.tsx  # Admin: AI-assisted event creation
│       ├── SituationReport.tsx# Admin: draft/confirm situation reports
│       ├── Coordination.tsx   # Admin: manage deployments
│       └── ActorNetwork.tsx   # Admin: manage actor registry
│
├── components/
│   ├── layout/                # Navigation, sidebars, layout wrappers
│   ├── dashboard/             # Admin dashboard: gap rows, sector cards, modals
│   ├── deployments/           # Deployment cards, field status reports
│   ├── sectors/               # Sector cards, detail drawers, enrollment
│   ├── actors/                # Actor forms, capability forms, contact forms
│   ├── map/                   # Leaflet map, sector pins, tooltips
│   ├── reports/               # Report editing, capability toggles
│   ├── field/                 # Audio recorder for field reports
│   └── ui/                    # ~40 shadcn/ui primitives (Button, Dialog, etc.)
│
├── services/                  # Business logic & Supabase API calls
│   ├── eventService.ts        # Events CRUD, sector/gap fetching, contextual demand upsert
│   ├── gapService.ts          # Gap grouping, enrichment, dashboard meta (all Supabase-backed)
│   ├── deploymentService.ts   # Deployment lifecycle (enroll → operating → finished)
│   ├── sectorService.ts       # Sector enrichment, filtering
│   ├── capabilityService.ts   # Actor capabilities (operational)
│   ├── actorNetworkService.ts # Actor CRUD (org, capabilities, zones, contacts)
│   ├── situationReportService.ts # AI report generation & confirmation
│   ├── needSignalService.ts   # Signal evaluation for gap needs
│   ├── fieldReportService.ts  # Field report uploads
│   ├── activityLogService.ts  # Activity logging
│   ├── tweetSignalService.ts  # Twitter signal ingestion
│   ├── matrixService.ts       # Sector × capability need-level matrix (Supabase-backed)
│   ├── index.ts               # Re-exports all services
│   └── mock/                  # Legacy mock data (retained for reference; no longer used by core services)
│       ├── data.ts            # Static mock arrays (events, sectors, deployments, etc.)
│       ├── delay.ts           # simulateDelay helper (still used by activityLogService)
│       └── generators.ts      # Mock ID generators
│
├── hooks/                     # Custom React hooks
│   ├── useAuth.tsx            # Auth context (user, roles, sign in/out)
│   ├── useSectorFocus.ts      # Map ↔ card sync state
│   ├── useActorMode.ts        # Role-based UI switching
│   ├── use-toast.ts           # Toast notifications
│   └── use-mobile.tsx         # Responsive breakpoint detection
│
├── types/                     # TypeScript type definitions
│   ├── database.ts            # Domain types (Event, Sector, Gap, Deployment, Actor, etc.)
│   ├── activityLog.ts         # Activity log types
│   └── fieldReport.ts         # Field report types
│
├── lib/                       # Core business logic (pure functions)
│   ├── needLevelEngine.ts     # Signal → need state transitions engine
│   ├── needStatus.ts          # Need level → visual status mapping (RED/ORANGE/YELLOW/GREEN/WHITE)
│   ├── sectorNeedAggregation.ts # Sector severity scoring
│   ├── stateTransitions.ts    # Gap & deployment state machines
│   ├── tweetSignalAggregation.ts # Tweet signal processing
│   ├── geocode.ts             # Location geocoding
│   └── utils.ts               # General utilities (cn, etc.)
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client initialization
│       └── types.ts           # Auto-generated DB types
│
├── test/                      # Test setup and unit tests
│   ├── setup.ts               # Vitest setup (jsdom, globals)
│   ├── needLevelEngine.test.ts
│   ├── needStatusTransitions.test.ts
│   ├── adjustStatusForCoverage.test.ts
│   ├── activityLog.test.ts
│   ├── tweetSignalAggregation.test.ts
│   ├── tweetSignalAggregator.test.ts
│   ├── geocode.test.ts
│   └── example.test.ts
│
├── App.tsx                    # Route definitions
├── main.tsx                   # React entry point
└── index.css                  # Global Tailwind styles

supabase/
├── config.toml                # Supabase project configuration
├── migrations/                # PostgreSQL schema migrations
│   ├── 20260120230302_*.sql   # Actor network tables
│   ├── 20260121000815_*.sql   # AI reports + event context needs
│   ├── 20260121111325_*.sql   # Deployment status enum alignment + seed data
│   ├── 20260215184553_*.sql   # Criticality levels for capacity types
│   └── 20260219215000_*.sql   # Additional schema updates
└── functions/                 # Supabase Edge Functions (Deno)
    ├── create-initial-situation-report/  # AI: generate event from text description
    ├── generate-situation-report/        # Full situation assessment
    ├── extract-text-report/              # Extract structured data from reports
    ├── transcribe-field-report/          # Audio → text transcription
    ├── collect-news-context/             # Fetch news articles for events
    └── fetch-tweets/                     # Ingest tweets as signals
```

---

## Key Data Flow

### 1. Admin Creates an Emergency (AI-Assisted)

```
Admin enters text description
  → Edge Function calls Claude API
  → Returns: event name, type, sectors, capabilities needed
  → Admin reviews/edits draft
  → On confirm: creates Event + Sectors + Needs in database
```

### 2. Signal Ingestion & Gap Detection

```
Signals arrive (tweets, SMS, news, field reports)
  → needSignalService evaluates each signal
  → needLevelEngine applies state transition rules
  → Gaps computed: sector × capability → state (evaluating/critical/partial/active)
  → Dashboard updates in real-time
```

### 3. Actor Enrollment & Deployment Lifecycle

```
Actor declares capabilities (shelter, medical, etc.)
  → Browses events, sees matching sectors/gaps
  → Enrolls → status: "interested"
  → Admin confirms → status: "confirmed"
  → Actor deploys → status: "operating"
  → Operation complete → status: "finished"
```

### 4. Gap State Machine

```
evaluating → critical (signals show unmet need, no actors)
critical → partial (some actors deployed, need still exists)
partial → active (sufficient coverage achieved)
active → partial/critical (new signals or actor withdrawal)
```

---

## Database Tables

### Core Tables
- **events** — Emergency instances
- **sectors** — Geographic sub-areas within events
- **capacity_types** — Types of capabilities (with criticality level)
- **deployments** — Actor ↔ sector ↔ capability assignments
- **sector_needs_sms / sector_needs_context** — Sector-level needs from different sources
- **event_context_needs** — Event-level (non-sector) needs
- **signals** — All incoming signal data
- **activity_logs** — Audit trail

### Actor Network Tables
- **actors** — Organization profiles
- **actor_capabilities_declared** — Strategic capability declarations
- **actor_habitual_zones** — Geographic presence zones
- **actor_contacts** — Contact information

### Auth & User Tables
- **profiles** — User profiles
- **user_roles** — Role assignments (admin/actor)

### AI Report Tables
- **initial_situation_reports** — AI-generated event drafts

---

## Existing Tests

| Test File | What It Tests |
|-----------|--------------|
| `needLevelEngine.test.ts` | Signal deduplication, RED floor, GREEN blocking, state transitions |
| `needStatusTransitions.test.ts` | Need status state machine transitions |
| `adjustStatusForCoverage.test.ts` | Coverage-based status adjustment (gap state + deployment count → final status) |
| `activityLog.test.ts` | Log source types, labels, formatting, weights |
| `tweetSignalAggregation.test.ts` | Tweet signal extraction & aggregation |
| `tweetSignalAggregator.test.ts` | Tweet aggregation logic |
| `geocode.test.ts` | Location geocoding utilities |
| `example.test.ts` | Basic test structure |

---

## Routes Summary

### Actor Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/auth` | Auth | Login/signup |
| `/dashboard` | Dashboard | Stats, events overview |
| `/events` | Events | Browse all events |
| `/events/new` | NewEvent | Create event manually |
| `/events/:eventId` | EventDetail | Event details |
| `/sectors` | Sectors | Browse sectors |
| `/my-capabilities` | MyCapabilities | Manage capabilities |
| `/my-deployments` | MyDeployments | View deployments |

### Admin Routes
| Route | Page | Purpose |
|-------|------|---------|
| `/admin/event-dashboard` | EventDashboard | Gap monitoring + map |
| `/admin/create-event` | CreateEventAI | AI event creation |
| `/admin/situation-report/draft` | SituationReport | Draft report editor |
| `/admin/coordination` | Coordination | Manage deployments |
| `/admin/actors` | ActorNetwork | Actor registry |

---

## Key Architectural Decisions

1. **Hybrid Signal Fusion** — Combines institutional data, social media (Twitter), SMS, and field reports to assess need levels per sector/capability.

2. **NeedLevelEngine (Pure Function)** — Core business logic for state transitions is in `lib/needLevelEngine.ts`, kept as pure functions with comprehensive tests.

3. **Two-Layer Actor Model** — Structural (persistent org profile in `actors` table) vs. Operational (event-specific capabilities/deployments).

4. **AI-Assisted Event Creation** — Claude API generates event structure from natural language, reducing admin burden during crisis.

5. **Gap Lifecycle** — Formal state machine (evaluating → critical → partial → active) ensures structured tracking of unmet needs.

6. **Role-Based UI** — Single SPA with admin and actor layouts, role determined via Supabase auth + user_roles table.

---

## Recent Changes (PR #32 — Mock → Supabase Migration)

The Admin/NGO flow was previously running on hardcoded mock data from `src/services/mock/data.ts`. All actions (create event, add sector, set need levels) wrote to in-memory arrays, making them invisible across views. PR #32 replaced these mock calls with real Supabase queries across 8 files (379 additions, 420 deletions).

### What Changed

| File | Before | After |
|------|--------|-------|
| **`eventService.ts`** | No contextual demand support | Added `addContextualDemand()` — upserts into `sector_needs_context` |
| **`matrixService.ts`** | `getMatrix()` returned `MOCK_SECTOR_CAPABILITY_MATRIX`; `updateCell()` called mock `updateMatrixCell()` | Queries/upserts `sector_needs_context` table; `NeedLevelExtended` type defined locally |
| **`gapService.ts`** | ~20 mock imports; `_mockGetGapsGroupedBySector()` fallback; all methods read from mock arrays | All methods query Supabase (`sectors`, `sector_needs_context`, `deployments`, `signals`, `profiles`); returns `[]` when no DB data exists; coverage-adjusted gap status via `adjustStatusForCoverage()` |
| **`Coordination.tsx`** | `handleCreateEvent` → `addEvent()` (mock); `handleCreateSector` → `addSector()` (mock); sector dropdown from `MOCK_SECTORS` | `handleCreateEvent` → `eventService.create()` + DB refresh; `handleCreateSector` → `eventService.addSector()`; sector dropdown from `eventService.getSectorsForEvent()` |
| **`AvailableActorsDrawer.tsx`** | Filtered `MOCK_ACTOR_CAPABILITIES`; hardcoded actor names (`'Cruz Roja Regional'`) | Queries `actor_capabilities` joined with `profiles`; shows real organization names |
| **`SectorDeploymentCard.tsx`** | `calculateSectorGaps()` from `MOCK_SECTOR_CAPABILITY_MATRIX`; `getRecentSignals()` from mock | Uses `sectorService.getEnrichedSectors()` via `useEffect` on drawer open |
| **`SectorCardAdmin.tsx`** | `SectorContext` imported from `mock/data` | Import moved to `deploymentService` |
| **`sectorService.ts`** | `ActorInSector` imported from `mock/data` | Import moved to `deploymentService` |

### Mock Module Status

The `src/services/mock/` directory is retained but mostly unused by core services:
- **`data.ts`** — 902 lines of static mock arrays. No longer imported by `gapService.ts`, `matrixService.ts`, `eventService.ts`, `Coordination.tsx`, `AvailableActorsDrawer.tsx`, or `SectorDeploymentCard.tsx`.
- **`delay.ts`** — `simulateDelay()` is still imported by `activityLogService.ts`.
- **`generators.ts`** — Mock ID generators. Not imported by any active service.

### Key New Behavior

- **Coverage-adjusted gap status** — `gapService.adjustStatusForCoverage()` downgrades severity when actors are deployed (e.g., `critical` + active deployments → `ORANGE` partial instead of `RED`).
- **Admin→NGO data flow** — Events, sectors, and contextual demands created by admins on the Coordination page now persist to Supabase and are visible to NGO actors in real time.
- **Empty-state handling** — When no sectors or needs exist in DB, services return `[]` instead of falling back to mock data.

---

## Plan for Future Development

Based on the current state of the codebase, here are identified areas for improvement:

### High Priority
- [ ] **Increase test coverage** — Add unit tests for services (eventService, gapService, deploymentService) and integration tests for critical flows
- [ ] **Add E2E tests** — Playwright tests for admin dashboard flow and actor enrollment flow
- [ ] **Real-time subscriptions** — Leverage Supabase Realtime for live gap/deployment updates on the admin dashboard
- [ ] **Error handling** — Add consistent error boundaries and retry logic across services

### Medium Priority
- [ ] **Offline support** — Service worker for field agents with intermittent connectivity
- [ ] **Notification system** — Push notifications for critical gap changes and deployment status updates
- [ ] **Audit logging** — Expand activity_logs to capture all state transitions
- [ ] **Performance** — Add React.memo/useMemo for expensive sector/gap computations

### Lower Priority
- [ ] **Internationalization (i18n)** — Currently Spanish-only, add multi-language support
- [ ] **Mobile-optimized views** — Improve responsive design for field agents using phones
- [ ] **Data export** — CSV/PDF export for situation reports and gap analyses
- [ ] **Role-based access refinement** — More granular permissions beyond admin/actor
