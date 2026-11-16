-- Admin portal: every approve / reject / hold decision an admin makes, with the reason the user was told.
-- subject_type: mentor (subject_id = user id), organisation (membership id), executive (path_waitlist id), professional (user id).
-- Server-only: RLS on, no grants to anon or authenticated.
create table if not exists public.admin_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('mentor', 'organisation', 'executive', 'professional')),
  subject_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  subject_label text check (subject_label is null or char_length(subject_label) <= 200),
  decision text not null check (decision in ('approved', 'rejected', 'hold')),
  reason text check (reason is null or char_length(reason) <= 500),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  in_app text not null default 'none' check (in_app in ('sent', 'none')),
  email text not null default 'none' check (email in ('sent', 'not_configured', 'failed', 'none'))
);
create index if not exists admin_reviews_subject_idx on public.admin_reviews (subject_type, subject_id, decided_at desc);
create index if not exists admin_reviews_recent_idx on public.admin_reviews (decided_at desc);
alter table public.admin_reviews enable row level security;
revoke all on public.admin_reviews from anon, authenticated;
