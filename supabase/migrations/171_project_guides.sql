-- Guided-project guides and their practice-data descriptions, written once by AI and kept, so a student opening a project gets it at once
-- and every student sees the same guide. Server only (service role); students never read or write this table directly.
create table public.project_guides (
  resource_id uuid primary key,
  guide jsonb,
  data jsonb,
  updated_at timestamptz not null default now()
);
alter table public.project_guides enable row level security;
revoke all on public.project_guides from anon, authenticated;
