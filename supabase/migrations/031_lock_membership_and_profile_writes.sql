-- Closes two client-side privilege holes found in the Job-Track review (docs/job-track-audit.md, Part A).
--
-- 1. institution_memberships: any authenticated client could INSERT its own row with arbitrary
--    values (role, goal_state, active_role_key, year_*...) via the `insert_own` policy. Every
--    legitimate insert already goes through the service role (app/api/education/institution)
--    or the SECURITY DEFINER signup trigger, so clients get no INSERT/UPDATE at all.
-- 2. profiles.primary_role was client-updatable, and the education API copies it into an active
--    membership role — a student could self-promote (e.g. to 'principal'). Clients may now
--    update only the profile columns the app actually edits.
--
-- Service-role API routes and SECURITY DEFINER functions are unaffected.

drop policy if exists institution_memberships_insert_own on public.institution_memberships;
revoke insert, update on public.institution_memberships from anon, authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, has_seen_career_direction_intro, portfolio_slug, portfolio_public)
  on public.profiles to authenticated;
