-- Pulse, phase 1: follow graph, blocks, reports, 24-hour stories, post kinds and images, discoverability.
-- Additive only. Social tables are server-mediated (service role after an auth check): no client policies, so
-- who may see a story or a follower list is decided in one place, never by a client query.
create extension if not exists pg_trgm with schema extensions;

-- People can opt out of search and suggestions (they still appear to people who follow them).
alter table public.profiles add column pulse_discoverable boolean not null default true;
create index profiles_full_name_trgm on public.profiles using gin (lower(full_name) extensions.gin_trgm_ops);

alter table public.posts add column kind text not null default 'post' check (kind in ('post', 'project', 'question', 'achievement'));
alter table public.posts add column image_path text check (char_length(image_path) <= 300);
create index posts_user_created_idx on public.posts (user_id, created_at desc);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

create table public.pulse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'post', 'comment', 'story')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index pulse_reports_open_idx on public.pulse_reports (status, created_at desc);

-- A story is visible for 24 hours (expires_at is the single source of truth; readers always filter on it).
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text', 'image')),
  body text check (char_length(btrim(body)) between 1 and 280),
  image_path text check (char_length(image_path) <= 300),
  theme smallint not null default 0 check (theme between 0 and 7),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  check ((kind = 'text' and body is not null and image_path is null) or (kind = 'image' and image_path is not null))
);
create index stories_user_expires_idx on public.stories (user_id, expires_at desc);
create index stories_expires_idx on public.stories (expires_at);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index story_views_viewer_idx on public.story_views (viewer_id);

do $$
declare t text;
begin
  foreach t in array array['follows', 'user_blocks', 'pulse_reports', 'stories', 'story_views'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Private media for stories and post images; reads are signed URLs minted server-side after the visibility check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pulse-media', 'pulse-media', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
