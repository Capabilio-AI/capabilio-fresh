-- Professional Pulse: a network for working professionals only, in its own tables (nothing here is shared with the student or graduate Pulse).
--  - pro_posts: updates, wins, resources and asks. Soft-deleted by the author.
--  - pro_post_likes, pro_post_comments: reactions.
--  - pro_follows: who follows whom.
--  - pro_reports: a professional flagging a post for review.
-- Server-only like the other pro_* tables: RLS on, no grants to anon or authenticated. The routes check the account is a professional.

create table if not exists public.pro_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('update', 'win', 'resource', 'ask')),
  title text check (title is null or char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  link text check (link is null or (char_length(link) <= 500 and link ~* '^https?://')),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pro_posts_feed_idx on public.pro_posts (created_at desc) where deleted_at is null;
create index if not exists pro_posts_author_idx on public.pro_posts (author_id, created_at desc) where deleted_at is null;

create table if not exists public.pro_post_likes (
  post_id uuid not null references public.pro_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.pro_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pro_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 800),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pro_post_comments_post_idx on public.pro_post_comments (post_id, created_at) where deleted_at is null;

create table if not exists public.pro_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists pro_follows_followee_idx on public.pro_follows (followee_id);

create table if not exists public.pro_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pro_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'misleading', 'other')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.pro_posts enable row level security;
alter table public.pro_post_likes enable row level security;
alter table public.pro_post_comments enable row level security;
alter table public.pro_follows enable row level security;
alter table public.pro_reports enable row level security;
revoke all on public.pro_posts, public.pro_post_likes, public.pro_post_comments, public.pro_follows, public.pro_reports from anon, authenticated;
