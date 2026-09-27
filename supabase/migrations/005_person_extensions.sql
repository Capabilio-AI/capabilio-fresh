-- STATUS: APPLIED to production 2026-09-27.
-- Additive only. professional_context/executive_context let a person
-- accumulate a new context without forking their identity (profiles.id
-- stays the same). audit_logs is required before any cross-user
-- recruiter/admin access ships (brief §12). References institutions(id) —
-- the live name, since 003_organisations_rename.sql was never applied.

create table public.professional_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.institutions(id) on delete set null,
  current_job_role text,
  target_job_role text,
  started_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.executive_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.institutions(id) on delete set null,
  capability_framework jsonb not null default '{}'::jsonb,
  leadership_goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  organisation_id uuid references public.institutions(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  access_reason text,
  consent_context jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on public.audit_logs(actor_id);
create index idx_audit_logs_organisation on public.audit_logs(organisation_id);

alter table public.professional_context enable row level security;
alter table public.executive_context enable row level security;
alter table public.audit_logs enable row level security;

create policy professional_context_self on public.professional_context
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy executive_context_self on public.executive_context
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_logs_self_read on public.audit_logs
  for select using (actor_id = auth.uid());

create trigger set_updated_at before update on public.professional_context
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.executive_context
  for each row execute function public.set_updated_at();
