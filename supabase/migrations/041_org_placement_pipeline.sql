-- Organisation Path, reference alignment (docs/org-path-reference-study.md): placement pipeline + outcomes,
-- Placement Wall consent, event RSVPs.

-- 1. `applications` was writable by any signed-in client through the FOR ALL policy, including its status
--    ('shortlisted', 'accepted'). A placement pipeline needs the college to own those transitions, so client
--    writes are revoked; students read their own rows, and only server routes write.
revoke insert, update, delete, truncate on public.applications from anon, authenticated;
revoke all on public.applications from anon;
drop policy if exists applications_self on public.applications;
create policy applications_read_own on public.applications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 2. Confirmed placements. Created only by a TPO/admin of the student's institution (server route); there is
--    no self-report path. show_on_wall is the STUDENT's consent (their own route), default off.
create table public.org_placements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  company text not null check (char_length(btrim(company)) between 1 and 200),
  role_title text not null check (char_length(btrim(role_title)) between 1 and 200),
  ctc_lpa numeric(7, 2) check (ctc_lpa is null or (ctc_lpa >= 0 and ctc_lpa <= 1000)),
  offer_date date,
  confirmed_by_membership_id uuid not null references public.institution_memberships(id) on delete no action,
  confirmed_at timestamptz not null default now(),
  show_on_wall boolean not null default false,
  unique (institution_id, student_user_id, company, role_title)
);
create index org_placements_institution_idx on public.org_placements (institution_id, confirmed_at desc);

-- 3. Event RSVPs (registration headcount for events / drive talks).
create table public.org_event_rsvps (
  post_id uuid not null references public.org_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rsvped_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['org_placements', 'org_event_rsvps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
