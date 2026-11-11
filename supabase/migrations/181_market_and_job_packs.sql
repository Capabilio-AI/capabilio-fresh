-- What the live job market says about a role, and the job-search pack built for it. Both belong to the career, not a student, and are written
-- only by the server (no policies: the service role is the only reader or writer).
-- market data holds counts and light job fields (title, company, place, pay, link), never full postings.
create table public.career_market_snapshots (
  career_id uuid primary key references public.careers(id) on delete cascade,
  data jsonb not null,
  sampled integer not null default 0 check (sampled >= 0),
  fetched_at timestamptz not null default now()
);
alter table public.career_market_snapshots enable row level security;

-- Interview topics and resume / portfolio checklists for a role, written by the AI from the role's skills and the market data above.
create table public.career_job_packs (
  career_id uuid primary key references public.careers(id) on delete cascade,
  data jsonb not null,
  model text,
  generated_at timestamptz not null default now()
);
alter table public.career_job_packs enable row level security;
