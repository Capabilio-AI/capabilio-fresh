-- Reverts the label -> start/end year inference from migration 030's backfill.
--
-- Why: the legacy "<year>-<semester>" label was unreliable (both affected rows say "1-2" but were
-- created in September, when a first-semester student would be "1-1"), and the derivation ignored
-- the semester digit entirely, so a derived start_year could easily be a year off. A pre-filled
-- guess is worse than a blank field: it looks authoritative. Those rows go back to unset and the
-- student is asked to enter their years (year_confirmed_at stays NULL => confirmation required,
-- no pre-fill). Rows the student entered themselves (degree set) are untouched.
update public.institution_memberships
set start_year = null, end_year = null
where role = 'student'
  and degree is null
  and year ~ '^[1-4]-[12]$'
  and year_confirmed_at is null
  and start_year is not null;
