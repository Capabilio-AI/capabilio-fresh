-- STATUS: APPLIED to production 2026-09-28.
-- The Educational History "Add" form used branch + a single-semester `year`
-- (e.g. "3-1") — fields that only make sense for an ongoing B.Tech, not for
-- schooling (10th), Intermediate, or a later M.Tech/MSc entry, which is
-- exactly why this project needs multi-entry history. New entries added
-- from that form now use degree/field_of_study/start_year/end_year
-- instead (LinkedIn-shaped: School, Degree, Field of study, Start-End).
--
-- branch/year are left as-is, not backfilled or dropped: they're still
-- what the signup trigger (handle_new_user) writes for a student's first,
-- current-B.Tech entry, and existing rows keep displaying correctly via
-- that fallback until a student edits them into the new shape.

alter table public.institution_memberships
  add column degree text,
  add column field_of_study text,
  add column start_year smallint,
  add column end_year smallint;

alter table public.institution_memberships
  add constraint institution_memberships_degree_length check (degree is null or char_length(degree) <= 200),
  add constraint institution_memberships_field_of_study_length
    check (field_of_study is null or char_length(field_of_study) <= 200),
  add constraint institution_memberships_start_year_range
    check (start_year is null or (start_year between 1980 and 2100)),
  add constraint institution_memberships_end_year_range
    check (end_year is null or (end_year between 1980 and 2100));
