-- A company visit can carry the company's website so students can read about the company before they register.
-- Additive and nullable; only http(s) links are accepted, so a stored value is always safe to render as a link.
alter table public.opportunities add column if not exists company_website text
  check (company_website is null or (char_length(company_website) <= 300 and company_website ~* '^https?://[^\s]+$'));
