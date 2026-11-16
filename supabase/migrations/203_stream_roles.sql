-- Roles to show first on Explore roles, per student stream (ece, eee, mech, civil, it, other). A stream's list is written once by the
-- stream-roles script (one AI step); every student after that reads it from here. Server-only: RLS on, no grants to anon or authenticated.
create table if not exists public.stream_roles (
  stream text not null check (stream in ('it', 'ece', 'eee', 'mech', 'civil', 'other')),
  career_id uuid not null references public.careers(id) on delete cascade,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (stream, career_id)
);
create index if not exists stream_roles_stream_idx on public.stream_roles (stream, position);
alter table public.stream_roles enable row level security;
