-- Authorization audit (Job-Track review, item 1): every check that keys off institution_memberships
-- must require status = 'active'. The app-level checks (can(), getOrgAdmin) already did; these three
-- read policies granted institution structure to ANY membership row, including 'pending' (an
-- unverified privileged signup) and 'revoked'. Same names, same shape, plus the status condition.
drop policy if exists programs_read_own_institution on public.programs;
create policy programs_read_own_institution on public.programs for select using (
  institution_id in (
    select m.institution_id from public.institution_memberships m
    where m.user_id = auth.uid() and m.status = 'active'
  )
);

drop policy if exists departments_read_own_institution on public.departments;
create policy departments_read_own_institution on public.departments for select using (
  program_id in (
    select p.id from public.programs p
    join public.institution_memberships im on im.institution_id = p.institution_id
    where im.user_id = auth.uid() and im.status = 'active'
  )
);

drop policy if exists cohorts_read_own_institution on public.cohorts;
create policy cohorts_read_own_institution on public.cohorts for select using (
  department_id in (
    select d.id from public.departments d
    join public.programs p on p.id = d.program_id
    join public.institution_memberships im on im.institution_id = p.institution_id
    where im.user_id = auth.uid() and im.status = 'active'
  )
);
