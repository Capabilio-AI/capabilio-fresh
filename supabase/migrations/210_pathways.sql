-- Any-goal pathways (docs/any-goal-pathways-design.md): a complete, sourced roadmap for goals that are not job-skill careers (exams, portfolio
-- careers, credentials, ventures). The whole validated pathway, facts included, is one JSON document per version; every date, limit and fee in it
-- is a fact with a source link, enforced by lib/pathways/rules.ts before anything is saved. Same life cycle as roadmap_templates:
-- DRAFT -> REVIEWED (a platform admin, recorded) -> PUBLISHED (the key's earlier published version is retired). Service-role only.
create table public.pathways (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 60),
  version int not null check (version >= 1),
  name text not null,
  kind text not null check (kind in ('exam', 'portfolio', 'credential', 'venture')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEWED', 'PUBLISHED', 'RETIRED')),
  -- 'curated' written by a person; 'ai_drafted' written by the model from cited facts and still needing review
  provenance text not null default 'curated' check (provenance in ('curated', 'ai_drafted')),
  spec jsonb not null,
  spec_hash text not null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (key, version)
);
-- at most one published version per key
create unique index pathways_one_published on public.pathways (key) where status = 'PUBLISHED';
create index pathways_status_idx on public.pathways (status);

alter table public.pathways enable row level security;
revoke all on public.pathways from anon, authenticated;
