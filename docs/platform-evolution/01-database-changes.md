# Database Changes

> **Status, corrected against what actually happened** (see `07-execution-log.md` for the full account): no Supabase branch was available (this project is on the free tier, which doesn't support branching). Every additive migration below **was applied directly to production** after your explicit approval, each verified via the security advisor and/or read-only RLS impersonation immediately after. The one rename migration was **not** applied — Claude Code's own safety classifier blocked it as destructive-looking DDL, independent of your approval. That file is written, live-verified, and waiting for manual application.

## Migration ordering (as actually applied)

1. **`002_career_os_foundations`** (applied) — college hierarchy, skills catalog, Journey Engine, Plan B, Project Lab, Evidence, Mentor Evaluation, Opportunities/Applications/Recruiters. References `institutions`/`institution_id` — the live names, since the rename below never ran.
2. **`004_rbac_foundations`** (applied) — `roles`, `role_permissions`, seeded.
3. **`005_person_extensions`** (applied) — `professional_context`, `executive_context`, `audit_logs`.
4. **`006`**/**`007`** (applied) — fixes to gaps the security advisor and a design review caught in 002/004 (see `07-execution-log.md`).
5. **`008`**/**`009`**/**`010`** (applied) — rate limiting infrastructure (§17 of the brief), added later in this same pass.
6. **`003_organisations_rename.sql`** — **NOT applied.** Written and verified against the live function definitions, blocked from automatic application. Would need to run before any future migration that expects `organisations`/`organisation_memberships` to already exist.

## (1) Organisations rename — exact plan

```sql
alter table public.institutions rename to organisations;
alter table public.organisations rename constraint institutions_pkey to organisations_pkey;
-- (name/slug unique constraints, city/state/college_type columns unchanged)
alter table public.organisations add column org_type text not null default 'education'
  check (org_type in ('education', 'workforce'));

alter table public.institution_memberships rename to organisation_memberships;
alter table public.organisation_memberships rename column institution_id to organisation_id;
alter table public.organisation_memberships
  rename constraint institution_memberships_institution_id_fkey to organisation_memberships_organisation_id_fkey;
alter table public.organisation_memberships
  rename constraint institution_memberships_user_id_fkey to organisation_memberships_user_id_fkey;
```

RLS policies are attached to the table's OID, not its name — **`ALTER TABLE ... RENAME` does not drop or require recreating them** (confirmed: none of the four existing policies on these two tables reference the table name in their `qual`/`with_check`, only `auth.uid() = user_id` and `true`). Verified directly, not assumed.

Then, in the same migration, `CREATE OR REPLACE FUNCTION` for the three dependents, each an exact port of the live definition (captured via `pg_get_functiondef` this session) with `institutions`/`institution_memberships`/`institution_id` replaced by the new names — same logic, same `SECURITY DEFINER`, same `search_path = ''`. `get_or_create_institution` is renamed to `get_or_create_organisation` (its only caller, `handle_new_user`, is updated in the same migration, so there's no window where they're out of sync).

## (3) RBAC foundations

```sql
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,             -- 'student', 'recruiter', 'company_admin', ...
  label text not null,
  scope text not null check (scope in ('platform', 'organisation')),  -- platform_admin is global; most roles are per-organisation
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  resource text not null,               -- 'person', 'organisation', 'opportunity', 'evidence', ...
  action text not null check (action in ('read', 'write', 'admin')),
  primary key (role_id, resource, action)
);
```

Seeded with the brief's minimum role set (§12): `student, graduate, professional, executive, mentor, faculty, hod, principal, university_admin, recruiter, hiring_manager, company_admin, platform_admin`, plus the existing `vice_principal`/`ceo` (kept — they're real, in-use institution admin roles not mentioned in the brief's list, and dropping them would break the 3 existing accounts that might hold them; §20 "don't break existing functionality"). Full matrix in `03-authorization-matrix.md`.

`organisation_memberships.role` **stays** an `app_role` enum column this pass (not migrated to `role_id` yet) — two systems coexist deliberately: the enum keeps every existing query (`getViewerSummary`, `handle_new_user`, `get_or_start_section`) working unchanged, while `roles`/`role_permissions` is the new authorization source of truth that `lib/auth/authorize.ts` reads. A view (`organisation_memberships_with_role_id`) bridges the two by name-matching `app_role` values to `roles.key`. Full enum-to-table migration (dropping the enum column) is a phase-2 item once every caller has moved off it — attempting both in one migration is exactly the kind of compounded risk this document exists to avoid.

## (4) Person extensions

```sql
create table public.professional_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,  -- current employer, nullable (between roles)
  current_role text,
  target_role text,
  started_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.executive_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  capability_framework jsonb not null default '{}'::jsonb,  -- configurable, not one hardcoded leadership model (§10)
  leadership_goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  access_reason text,
  consent_context jsonb,
  created_at timestamptz not null default now()
);
```

A person with no `professional_context`/`executive_context` row is simply a student — these are additive facts about an existing `profiles` row, never a fork of it, which is the mechanism that makes Student→Professional→Executive transitions lossless: the same `user_id` just accumulates more context rows over time.

## Tenant boundaries, indexes, soft-delete — carried over

Everything from the prior session's `01-domain-model.md` (tenant-scoping pattern, append-only evidence tables, `updated_at` trigger convention) applies unchanged to the new tables here; not repeated. New indexes: `idx_organisation_memberships_organisation` (was `idx_institution_memberships_cohort`, still valid post-rename), `idx_role_permissions_role`, `idx_audit_logs_actor`, `idx_audit_logs_organisation`.
