-- Module C (placement drives): reuse `opportunities` (already has institution_id and created_by).
-- Its read policy was `true`, which would expose a college's private drive to everyone.
-- Platform-wide listings (institution_id null) stay public; an institution's drive is readable only by
-- ACTIVE members of that institution. Writes remain service-role only (no write policy exists).
drop policy if exists opportunities_read_all on public.opportunities;
create policy opportunities_read_platform_or_own_institution on public.opportunities
  for select
  using (
    institution_id is null
    or exists (
      select 1 from public.institution_memberships m
      where m.institution_id = opportunities.institution_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    )
  );
