-- Company public profile. Reuses the institution tables that already carry a page, posts, follows and likes:
--   org_profiles (is_public, bio, cover, website), org_posts, org_follows, org_post_likes.
-- This adds what only a company has, and widens the post types so a company can post updates, hiring news and milestones.
-- Service-role only like its siblings: the server checks the caller, then reads and writes.
create table if not exists public.company_profiles (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  tagline text check (char_length(tagline) <= 140),
  mission text check (char_length(mission) <= 600),
  industry text check (char_length(industry) between 2 and 60),
  size_band text check (size_band in ('1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+')),
  founded_year int check (founded_year between 1800 and 2100),
  hq_city text check (char_length(hq_city) <= 80),
  logo_url text check (logo_url ~ '^https?://' and char_length(logo_url) <= 2000),
  accent text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  culture text[] not null default '{}' check (cardinality(culture) <= 8),
  perks text[] not null default '{}' check (cardinality(perks) <= 12),
  tech_stack text[] not null default '{}' check (cardinality(tech_stack) <= 20),
  updated_at timestamptz not null default now()
);
alter table public.company_profiles enable row level security;
revoke all on public.company_profiles from anon, authenticated;

alter table public.org_posts drop constraint if exists org_posts_type_check;
alter table public.org_posts add constraint org_posts_type_check check (type in ('event', 'announcement', 'update', 'hiring', 'milestone'));
