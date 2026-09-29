-- Removing a staff member (or an institution) must not be blocked by the records they created.
-- Found by the live cleanup: deleting an institution failed with class_submissions_check because the confirming
-- membership's ON DELETE SET NULL violated "physical submissions need a confirming staff member".

-- A received physical submission stays a submission after its confirmer is removed.
alter table public.class_submissions drop constraint class_submissions_check;
alter table public.class_submissions add constraint class_submissions_check
  check ((submission_type = 'in_app' and link_url is not null) or submission_type = 'physical');

-- A confirmed placement stays on record after the officer who confirmed it leaves (was NO ACTION => blocked
-- deleting that account). The confirmer is kept while they exist and nulled when they are removed.
alter table public.org_placements alter column confirmed_by_membership_id drop not null;
alter table public.org_placements drop constraint org_placements_confirmed_by_membership_id_fkey;
alter table public.org_placements add constraint org_placements_confirmed_by_membership_id_fkey
  foreign key (confirmed_by_membership_id) references public.institution_memberships(id) on delete set null;
