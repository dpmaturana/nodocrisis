# NodoCrisis

A crisis response coordination platform for managing emergency situations. NodoCrisis helps coordinate actors (organizations, volunteers, resources) across geographic sectors, facilitating deployment coordination, capability tracking, and situational awareness during crises.

## Features

### Actor Views (Protected)

- **Dashboard** — Overview of active crisis events and key metrics
- **Events** — Browse, create, and view crisis event details
- **Sectors** — Geographic sector management and enrollment with interactive maps
- **My Capabilities** — Declare and manage organizational capabilities
- **My Deployments** — Track deployments and submit field status reports

### Admin Views

- **Create Event (AI-assisted)** — Generate crisis events with AI assistance
- **Situation Reports** — Draft and view situational reports
- **Event Dashboard** — Admin-level event overview and analytics
- **Coordination** — Coordinate crisis response across actors
- **Actor Network** — Manage participating organizations

### Core Components

- **Interactive Map** — Leaflet-based sector maps with pins and tooltips
- **Gap Analysis** — Identify capability gaps in crisis response
- **Field Reports** — Submit reports from the field, including audio recording
- **Capability Matrix** — Track and assign capabilities across deployments

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build Tool | [Vite](https://vite.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives) |
| State & Data | [TanStack React Query](https://tanstack.com/query) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Backend | [Supabase](https://supabase.com/) (PostgreSQL + Auth) |
| Maps | [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/) |
| Charts | [Recharts](https://recharts.org/) |
| Testing | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + [Testing Library](https://testing-library.com/) |
| Linting | [ESLint](https://eslint.org/) |

## Project Structure

```
src/
├── components/         # UI components
│   ├── ui/            # shadcn/ui base components
│   ├── layout/        # App layout, sidebar, header
│   ├── dashboard/     # Dashboard widgets
│   ├── map/           # Map visualization
│   ├── sectors/       # Sector management
│   ├── actors/        # Actor/organization management
│   ├── deployments/   # Deployment tracking
│   ├── reports/       # Situation reports
│   └── field/         # Field reports (audio recording)
├── pages/             # Route pages
│   └── admin/         # Admin-specific pages
├── services/          # API and business logic
├── hooks/             # Custom React hooks
├── types/             # TypeScript type definitions
├── integrations/      # External service clients (Supabase)
├── lib/               # Utility functions
└── test/              # Test files
supabase/
├── migrations/        # Database migrations
└── functions/         # Supabase Edge Functions
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Installation

```sh
# Clone the repository
git clone https://github.com/dpmaturana/nodocrisis.git
cd nodocrisis

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Create a development build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests once with Vitest |
| `npm run test:watch` | Run tests in watch mode |
