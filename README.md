# Capabilio AI

Capabilio AI is a career-readiness platform for engineering students. It turns the scattered evidence of a student's academic record, skills, projects, and real GitHub activity into a structured, verifiable picture of where they stand and what to work on next — and connects that picture to concrete opportunities (interviews, mentors, jobs).

The goal is to replace self-reported resumes and generic advice with **grounded, computed evidence**: skill levels come from actual assessment attempts, career direction recommendations are explained against a student's real interest and skill data, and engineering credibility (Code DNA) is built from a real scan of public GitHub repositories, commits, and pull requests — not a claim the student typed in.

## What it does

- **Dashboard** — a student's home base: Overview, Career Path, Educational History (institution, program, cohort, milestone timeline), Portfolio, Skills, Skill Gap, and Vault, all backed by real Supabase-stored data.
- **Career Direction Explainer** — a one-time, data-grounded explanation of why a particular career direction is recommended, sourced from real skill and interest signals rather than a canned message.
- **Vault + Code DNA** — a portfolio store (certificates, projects, links, resumes) plus Code DNA: connect a GitHub account, verify ownership via a bio code (no OAuth), and get an AI-scored engineering fingerprint built only from real, scanned facts (tech stack from file presence, testing/CI/docs practice, authorship vs. forks, PR activity) — with an explicit limitations section, never a fabricated "plagiarism check."
- **Arena** — skill assessments that feed real skill-level data back into the dashboard and recommendations.
- **SkillStudio** — structured skill-building.
- **Skill Gap** — the delta between a student's current skills and the ones their target direction needs.
- **Launchpad** — opportunities (roles, internships) matched to a student's profile.
- **Interview** — interview preparation.
- **Mentor** — an AI mentor chat, contextualized with a student's real career direction and skill gaps.
- **Pulse** — an activity feed.
- **Notifications, Settings, Profile** — standard account surfaces.

## Under the hood

- **Person / Organisation / Capability model** — institutions, cohorts, programs, and memberships are modeled explicitly, with a normalized RBAC system (`roles` / `role_permissions`) governing staff access to student records. Self-access is always implicit; the permission model only gates access to *other* people's data.
- **Real evidence, not mocked data** — assessment results, education history, and Code DNA are all read from actual stored records; Groq (LLM) is used for narrative/explanatory text only, never to invent facts.
- **Rate limiting** — a DB-backed, atomic fixed-window limiter (Postgres RPC) protects sensitive endpoints like Code DNA scans.
- **Testing & CI** — Vitest unit tests, ESLint, and a GitHub Actions workflow (typecheck → lint → test → build) gate changes.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4
- [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security
- [Groq](https://groq.com) — LLM inference for narrative generation (career explanations, Code DNA summaries, mentor chat)
- Zod for schema validation
- Vitest for testing

## Getting Started

Install dependencies and set up your environment:

```bash
npm install
cp .env.example .env.local  # if present — otherwise set the vars below
```

Required environment variables (Supabase project + Groq API key):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
npm run build        # next build
```

## Project structure

```
app/            # App Router routes and API route handlers
components/     # UI components, organized by feature
lib/            # Domain logic, Supabase clients, Code DNA scanning, career/RBAC logic
supabase/       # Numbered SQL migrations (source of truth for schema)
docs/           # Architecture and audit notes
```
