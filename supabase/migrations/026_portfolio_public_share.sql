-- STATUS: pending. Additive only. Lets a student generate a public,
-- read-only portfolio link to share with recruiters. The slug is an opaque
-- random token (never the profile id) so a link can be revoked by
-- regenerating it without touching the account.
alter table public.profiles
  add column portfolio_slug text unique,
  add column portfolio_public boolean not null default false;
