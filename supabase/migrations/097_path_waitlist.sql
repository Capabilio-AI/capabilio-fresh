-- Early-access requests for the Working Professional and Executive paths. No account is created; written only through the server (service role).
create table public.path_waitlist (
  id uuid primary key default gen_random_uuid(),
  path text not null check (path in ('professional', 'executive')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  role_title text check (char_length(role_title) <= 120),
  company text check (char_length(company) <= 200),
  created_at timestamptz not null default now()
);
create unique index path_waitlist_path_email_key on public.path_waitlist (path, lower(email));
alter table public.path_waitlist enable row level security;
revoke all on public.path_waitlist from anon, authenticated;
