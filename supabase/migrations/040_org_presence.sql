-- Organisation Path, Module A: scoped public presence (docs/org-path-audit.md). Events + announcements,
-- follow, like, share-link. No comments, no freeform feed. Service-role only tables; visibility is
-- decided server-side (public page requires organisation_profiles.is_public; announcements are
-- members-only unless the post is flagged public).
create table public.org_profiles (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  bio text check (char_length(bio) <= 3000),
  cover_image_url text check (cover_image_url ~ '^https?://' and char_length(cover_image_url) <= 2000),
  website_url text check (website_url ~ '^https?://' and char_length(website_url) <= 2000),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.org_posts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  author_membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  type text not null check (type in ('event', 'announcement')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  cover_image_url text check (cover_image_url ~ '^https?://' and char_length(cover_image_url) <= 2000),
  event_starts_at timestamptz,
  event_location text check (char_length(event_location) <= 300),
  event_link text check (event_link ~ '^https?://' and char_length(event_link) <= 2000),
  is_public boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (type <> 'event' or event_starts_at is not null),
  check (status <> 'published' or published_at is not null)
);
create index org_posts_institution_idx on public.org_posts (institution_id, status, published_at desc);

create table public.org_follows (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (institution_id, user_id)
);

create table public.org_post_likes (
  post_id uuid not null references public.org_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  liked_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['org_profiles','org_posts','org_follows','org_post_likes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
