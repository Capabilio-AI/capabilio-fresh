-- STATUS: APPLIED to production 2026-09-28.
-- Lets a certificate be tied to a specific educational-history entry, now
-- that a student can have more than one (previous school, current
-- college, etc. — institution_memberships already allowed multiple rows
-- per user at the DB level via unique(user_id, institution_id); only the
-- application layer assumed a single row). Nullable: certificates added
-- from the generic Vault "Add item" form aren't tied to any institution.

alter table public.vault_items
  add column institution_membership_id uuid references public.institution_memberships(id) on delete set null;
