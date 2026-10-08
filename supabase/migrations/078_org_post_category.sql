-- Org posts get a category (what the college is sharing). Additive and nullable: existing rows keep working
-- (a null category reads as "event" for type=event and "announcement" otherwise).
alter table public.org_posts
  add column if not exists category text
  check (category is null or category in ('announcement', 'event', 'fest', 'poster', 'achievement', 'admissions'));
