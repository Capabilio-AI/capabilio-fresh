-- A college invites a company to a campus visit (the company accepts or declines), and the two can message each other.
-- Service-role only like the other org_* tables: the server checks the caller's membership, then reads and writes.
create table public.campus_visit_requests (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.institutions(id) on delete cascade,
  company_id uuid not null references public.institutions(id) on delete cascade,
  role text not null check (char_length(btrim(role)) between 2 and 120),
  proposed_date date,
  location text check (char_length(location) <= 160),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  response_note text check (char_length(response_note) <= 500),
  created_by uuid references public.profiles(id) on delete set null,
  responded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (college_id <> company_id)
);
-- one open invitation per college-company pair
create unique index campus_visit_requests_open_idx on public.campus_visit_requests (college_id, company_id) where status = 'pending';
create index campus_visit_requests_company_idx on public.campus_visit_requests (company_id, created_at desc);
create index campus_visit_requests_college_idx on public.campus_visit_requests (college_id, created_at desc);

create table public.org_threads (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.institutions(id) on delete cascade,
  company_id uuid not null references public.institutions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (college_id, company_id),
  check (college_id <> company_id)
);

create table public.org_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.org_threads(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_institution_id uuid not null references public.institutions(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index org_thread_messages_thread_idx on public.org_thread_messages (thread_id, created_at desc);

create table public.org_thread_reads (
  thread_id uuid not null references public.org_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['campus_visit_requests', 'org_threads', 'org_thread_messages', 'org_thread_reads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
