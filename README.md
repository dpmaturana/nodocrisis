# NodoCrisis

**A hybrid rules + LLM decision engine for real-time coordination in climate emergencies.**

NodoCrisis is a coordination platform I designed and built to solve a specific systems problem: in the first 72 hours of a disaster, no shared operational picture exists. Agencies, NGOs, and volunteers operate from fragmented spreadsheets and WhatsApp groups. Critical sectors go uncovered not because resources are absent, but because the gaps are invisible.

The platform fuses multi-source signals into a live, explainable gap-priority map — and orchestrates actor deployments across it.

→ **[Live demo](https://nodocrisis.lovable.app)** · **[Demo video](https://drive.google.com/file/d/1NHAoQqOwZtFz8dsLhQRHZ4h-YqvAEgEV/view?usp=drive_link)**

---

## The core design challenge

The hardest part wasn't building the interface. It was designing a system where AI could assist high-stakes prioritization decisions *without* creating new risks.

Three constraints shaped every architecture decision:

1. **False negatives are life-threatening.** A sector incorrectly marked as covered when it isn't can mean no one goes there.
2. **Coordinators operate under extreme cognitive load.** The system must inform decisions, not require them to interpret AI outputs under pressure.
3. **Every decision needs to be auditable after the event**, for accountability, learning, and donor reporting.

---

## Architecture: Need Evaluation Engine

The core of the system is a hybrid evaluation engine that runs per `event × sector × capability` tuple.

### Signal pipeline

Incoming information is classified into 5 signal types before entering the engine:

| Signal type | What it captures |
|---|---|
| `INSUFFICIENCY` | Active shortage reported by a field actor |
| `STABILIZATION` | Coverage confirmed as sufficient |
| `COVERAGE_ACTIVITY` | Actor operating in the sector |
| `COVERAGE_INTENT` | Actor enrolled but not yet deployed |
| `FRAGILITY_ALERT` | Coverage present but at risk of collapsing |
| `DEMAND` | Need level reported independently of coverage |

Each signal carries a **source weight** (admin report > field report > system-generated) and a **confidence score**.

### Scoring layer

Signals aggregate into 5 dimensional scores:

- `demandScore` — strength of unmet demand evidence
- `insufficiencyScore` — severity and recency of shortage signals
- `stabilizationScore` — strength of coverage confirmation
- `fragilityScore` — risk of coverage collapse
- `coverageScore` — active deployment presence

Scores produce 6 boolean flags (`demandStrong`, `insuffStrong`, `stabilizationStrong`, `fragilityAlert`, `coverageActive`, `coverageIntent`) used downstream.

### Dual evaluation path

The engine runs two paths in parallel:

**Rule-based path:** Deterministic evaluation using the 6 boolean flags. Always runs. Produces a proposed status without LLM dependency.

**LLM path (Claude):** The flags, scores, and evidence quotes are passed to Claude with a structured prompt. Claude proposes a status and returns reasoning text. This path is optional — if unavailable or low-confidence, the system falls back to rule-based.

### 7 Safety guardrails

Before any status is written, the proposed output (from either path) passes through hardcoded guardrails that cannot be overridden by the AI:

| Guardrail | Rule |
|---|---|
| A | `demandStrong AND NOT coverageActive` → force `RED` |
| B | `fragilityAlert` present → cannot be `GREEN` |
| C | `GREEN` only permitted when `stabilizationStrong AND NOT (insuffStrong OR fragilityAlert)` |
| D | `RED → GREEN` direct transition is illegal (must pass through intermediate state) |
| E | Life-threatening capability with any `INSUFFICIENCY` signal → minimum `ORANGE` |
| F | Zero coverage signals + any demand → minimum `ORANGE` |
| G | AI confidence below threshold → fall back to rule-based result |

### Legal transition table

Status transitions follow a validated state machine. Direct jumps (e.g., `RED → GREEN`) are blocked regardless of what the AI proposes. This prevents a well-intentioned but premature stabilization signal from masking an ongoing critical need.

### Audit trail

Every evaluation — including evaluations where the status did not change — writes an immutable record to `need_audits`:

```
previous_status → proposed_status → final_status
scores snapshot (all 5 dimensions)
guardrails fired (boolean array)
AI reasoning text
evidence quotes from field reports
model name + confidence score
evaluation timestamp
```

This is not a logging feature. It's a core accountability mechanism: coordinators can open any need level and see exactly why it is what it is, and whether the AI was overridden.

---

## Sector status computation

Capability need levels aggregate into a sector status via weighted scoring:

- Life-threatening capabilities carry 3× weight
- High-priority capabilities carry 2× weight
- Override rule: any single `RED` life-threatening capability forces sector status to `Critical`

This ensures that general coverage in a sector cannot mask a critical gap in a specific capability (e.g., medical teams absent despite food distribution being active).

---

## AI-assisted event creation

A separate pipeline handles event initialization from unstructured input:

1. Coordinator pastes free text (field note, news excerpt, situation description)
2. System retrieves corroborating news context via external API
3. Claude generates a structured draft: event name/type, summary, suggested sectors, suggested capabilities, confidence score
4. Coordinator edits and confirms — **nothing becomes live until explicit human confirmation**

The AI never creates an event. It proposes a draft.

---

## Tech stack

| Layer | Implementation |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| AI | Anthropic Claude API (Haiku for extraction, Sonnet for reasoning) |
| Maps | Leaflet |
| Testing | Vitest + Testing Library + Playwright (e2e) |
| Database logic | PL/pgSQL (row-level security, audit immutability) |

Edge Functions implement the evaluation engine and AI pipelines. The frontend never calls the Claude API directly — all AI calls are server-side with API keys stored as Edge Function secrets.

---

## Responsible AI design decisions

A few decisions worth noting for anyone evaluating this from a governance or AI safety lens:

**Human-in-the-loop is architectural, not a feature.** The system cannot autonomously create events, change need levels, or deploy actors. Every state change requires a human signal.

**Explainability is a first-class requirement.** Every need level comes with a reasoning summary, score breakdown, and guardrail log. Coordinators don't just see that a sector is red — they see why.

**Silent sectors are made visible.** A sector with no actors and no reports shows as `UNKNOWN` (⚪), not as covered. The absence of signals is surfaced as a risk, not treated as stability.

**Bias toward well-connected sectors is an identified risk.** Sectors with more enrolled actors generate more signals and appear better-evaluated. Remote sectors with zero actors are systematically under-assessed. This is documented as a known limitation and flagged for pilot validation.

**The audit trail supports post-event accountability.** Every AI-influenced decision is traceable to its inputs, the model used, and whether a guardrail overrode it. This aligns with EU AI Act Art. 13 transparency requirements for high-risk AI systems.

---

## What I designed vs. what the tooling built

The evaluation engine logic, guardrail system, signal taxonomy, scoring model, legal transition table, and audit schema were designed by me. Lovable (an AI-assisted frontend builder) was used to accelerate UI implementation. The architectural decisions — including the choice to make guardrails hardcoded constants that the LLM cannot override, the dual-path evaluation structure, and the audit immutability constraint — are mine.

---

## Repository structure

```
src/
├── components/
│   ├── actors/          # Actor enrollment and deployment UI
│   ├── dashboard/       # Admin coordination dashboard
│   ├── deployments/     # Deployment lifecycle management
│   ├── field/           # Field report submission (text + audio)
│   ├── map/             # Gap priority map (Leaflet)
│   ├── reports/         # Audit trail viewer
│   └── sectors/         # Sector status and capability drill-down
├── pages/               # Route-level components
├── services/            # API and evaluation engine calls
├── hooks/               # React hooks
└── types/               # TypeScript type definitions
supabase/
├── functions/           # Edge Functions (evaluation engine, AI pipelines)
└── migrations/          # Database schema and RLS policies
```

---

## Running locally

```bash
git clone https://github.com/dpmaturana/nodocrisis
cd nodocrisis
npm install
npm run dev
```

Requires: Supabase project + Claude API key configured as environment variables (see `.env.example`).

---

## Context

Built as part of a Master in Computer Science and Business Technology at IE University (Madrid, 2025–2026). The system design was informed by post-event analyses of the 2024 Valparaíso wildfires and coordination failures documented in OCHA and IFRC field reports.

The business plan, responsible AI framework, and pilot validation methodology are available in [`CODEBASE_OVERVIEW.md`](./CODEBASE_OVERVIEW.md).

---

*Daniela Maturana · [LinkedIn](https://linkedin.com/in/danielamaturana) · dmaturana@student.ie.edu*
