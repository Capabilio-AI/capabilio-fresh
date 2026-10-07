-- Pulse, phase 3: communities (college, branch, interest) and verified mentors. Server-mediated like the rest of Pulse.
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('college', 'branch', 'interest')),
  name text not null check (char_length(btrim(name)) between 3 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70),
  description text check (char_length(description) <= 400),
  institution_id uuid references public.institutions(id) on delete cascade,
  branch_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (
    (kind = 'college' and institution_id is not null and branch_key is null) or
    (kind = 'branch' and institution_id is not null and branch_key is not null) or
    (kind = 'interest' and institution_id is null and branch_key is null)
  )
);
create unique index communities_college_idx on public.communities (institution_id) where kind = 'college';
create unique index communities_branch_idx on public.communities (institution_id, branch_key) where kind = 'branch';
create unique index communities_interest_name_idx on public.communities (lower(btrim(name))) where kind = 'interest';

-- Interest communities have explicit members. College and branch communities are derived from a person's academic membership.
create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

create table public.community_bans (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 3000),
  kind text not null default 'post' check (kind in ('post', 'project', 'question', 'achievement')),
  image_path text check (char_length(image_path) <= 300),
  created_at timestamptz not null default now()
);
create index community_posts_feed_idx on public.community_posts (community_id, created_at desc);

create table public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index community_post_comments_post_idx on public.community_post_comments (post_id, created_at);

-- A mentor is a person Capabilio has reviewed. Editing the public text sends the profile back for review (done in code).
create table public.mentor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  headline text not null check (char_length(btrim(headline)) between 5 and 120),
  bio text not null check (char_length(btrim(bio)) between 20 and 800),
  expertise text[] not null check (cardinality(expertise) between 1 and 8),
  company text check (char_length(company) <= 120),
  role_title text check (char_length(role_title) <= 120),
  years_experience smallint check (years_experience between 0 and 60),
  availability text check (char_length(availability) <= 200),
  is_accepting boolean not null default true,
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mentor_profiles_status_idx on public.mentor_profiles (status, updated_at desc);

do $$
declare t text;
begin
  foreach t in array array['communities', 'community_members', 'community_bans', 'community_posts', 'community_post_likes', 'community_post_comments', 'mentor_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

alter table public.pulse_reports drop constraint pulse_reports_target_type_check;
alter table public.pulse_reports add constraint pulse_reports_target_type_check
  check (target_type in ('user', 'post', 'comment', 'story', 'message', 'community', 'community_post'));

-- Starter interest communities, so the directory is never empty.
insert into public.communities (kind, name, slug, description) values
  ('interest', 'Data Analytics', 'data-analytics', 'SQL, Excel, dashboards and the road to your first analyst role.'),
  ('interest', 'Web Development', 'web-development', 'Frontend, backend and full-stack: projects, questions and code reviews.'),
  ('interest', 'AI and Machine Learning', 'ai-and-machine-learning', 'Models, data and the maths behind them. Share what you are training.'),
  ('interest', 'Cybersecurity', 'cybersecurity', 'Security fundamentals, CTFs and certifications.'),
  ('interest', 'Placements and Interviews', 'placements-and-interviews', 'Prepare together: aptitude, coding rounds, HR and interview experiences.'),
  ('interest', 'Higher Studies', 'higher-studies', 'GATE, GRE, CAT, MS applications and what to expect.'),
  ('interest', 'Startups and Entrepreneurship', 'startups-and-entrepreneurship', 'Ideas, founders and building something of your own.'),
  ('interest', 'Competitive Programming', 'competitive-programming', 'Contests, problems and the habit of solving daily.')
on conflict do nothing;
