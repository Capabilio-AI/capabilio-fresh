-- A recruiter pack: one share link a student creates for one recruiter. The link is the consent: it names exactly which sealed work samples are included,
-- when it stops working, and whether contact details appear. The student can revoke it at any time and sees how often it was opened. It works whether or
-- not the student's public portfolio is on.
create table if not exists public.recruiter_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  label text not null check (length(label) between 1 and 80),
  attempt_ids uuid[] not null default '{}' check (cardinality(attempt_ids) between 1 and 50),
  include_contact boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recruiter_shares_user_idx on public.recruiter_shares (user_id, created_at desc);

alter table public.recruiter_shares enable row level security;
create policy "own recruiter shares" on public.recruiter_shares for select using (user_id = auth.uid());
-- no insert, update or delete policy: the server creates and revokes shares and counts views, after checking the student owns every record in it
