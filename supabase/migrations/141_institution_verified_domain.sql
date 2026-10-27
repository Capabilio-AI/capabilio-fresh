-- Automatic college verification: the first person to register a brand-new institution with an academic email address (ac.in, edu.in, res.in, edu)
-- proves the college's domain. Later staff who register with an address on that same domain are activated without manual review (faculty only;
-- principal, HOD and TPO still wait for an existing admin). One domain can verify only one institution.
alter table public.institutions
  add column if not exists verified_domain text,
  add column if not exists domain_verified_at timestamptz;

create unique index if not exists institutions_verified_domain_key on public.institutions (verified_domain) where verified_domain is not null;
