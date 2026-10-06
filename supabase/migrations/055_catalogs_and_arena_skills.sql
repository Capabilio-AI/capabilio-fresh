-- Phase 6: the three catalogs the roadmap may recommend from (certifications, learning resources, projects), and canonical skill tags
-- on Arena challenges. docs/curriculum-roadmap-v2-progress.md. Principle: the roadmap only ever recommends what is CONFIGURED here — so the
-- catalogs start empty (apart from the two certifications already curated in skill_area_resources) and are filled by an operator seed path.
--
-- ADDITIVE. skill_area_resources (read by today's roadmap engine) is untouched. Catalogs are world-readable data; writes are service-role only.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Certifications
create table public.certification_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  provider text not null check (char_length(btrim(provider)) between 2 and 120),
  /** NULL when the provider doesn't state a level — never guessed */
  difficulty text check (difficulty is null or difficulty in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  url text check (url is null or url ~ '^https://'),
  cost text check (cost is null or char_length(cost) <= 200),
  duration text check (duration is null or char_length(duration) <= 200),
  eligibility text check (eligibility is null or char_length(eligibility) <= 400),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, name)
);
create trigger set_updated_at before update on public.certification_catalog for each row execute function public.set_updated_at();
create table public.certification_skills (
  certification_id uuid not null references public.certification_catalog(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  primary key (certification_id, skill_id)
);
-- How much a career needs the certification is DATA stated by an operator, never inferred: REQUIRED / RECOMMENDED / OPTIONAL.
create table public.certification_careers (
  certification_id uuid not null references public.certification_catalog(id) on delete cascade,
  career_id uuid not null references public.careers(id) on delete cascade,
  relevance text not null default 'OPTIONAL' check (relevance in ('REQUIRED', 'RECOMMENDED', 'OPTIONAL')),
  primary key (certification_id, career_id)
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Learning resources (courses, tutorials, books…) as configured by an operator. SkillStudio's content is mock data, so nothing is migrated.
create table public.learning_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  provider text not null check (char_length(btrim(provider)) between 2 and 120),
  url text check (url is null or url ~ '^https://'),
  /** the capability range (0–100) the resource takes a learner across */
  level_from smallint not null check (level_from between 0 and 100),
  level_to smallint not null check (level_to between 0 and 100),
  estimated_hours numeric(6, 1) check (estimated_hours is null or estimated_hours > 0),
  prerequisites text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (level_to > level_from),
  unique (provider, title)
);
create trigger set_updated_at before update on public.learning_catalog for each row execute function public.set_updated_at();
create table public.learning_item_skills (
  item_id uuid not null references public.learning_catalog(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  primary key (item_id, skill_id)
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Projects. AI_GENERATED rows are RECOMMENDATIONS for ONE student: they can never be ACTIVE catalog entries.
create table public.project_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  difficulty text not null check (difficulty in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
  expected_evidence text[] not null default '{}',
  source text not null check (source in ('CAPABILIO', 'COLLEGE', 'MENTOR', 'AI_GENERATED')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'RECOMMENDATION')),
  /** COLLEGE projects belong to one institution */
  institution_id uuid references public.institutions(id) on delete cascade,
  /** AI_GENERATED recommendations belong to one student */
  for_student_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_projects_are_recommendations check ((source = 'AI_GENERATED') = (status = 'RECOMMENDATION') or (source = 'AI_GENERATED' and status = 'ARCHIVED')),
  constraint ai_projects_belong_to_a_student check ((source = 'AI_GENERATED') = (for_student_id is not null)),
  constraint college_projects_belong_to_a_college check ((source = 'COLLEGE') = (institution_id is not null))
);
create trigger set_updated_at before update on public.project_catalog for each row execute function public.set_updated_at();
create index project_catalog_active on public.project_catalog (status, source);
create table public.project_skills (
  project_id uuid not null references public.project_catalog(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  primary key (project_id, skill_id)
);

-- A catalog item can only teach / cover ACTIVE skills.
create function public.guard_catalog_skill_active() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.skills where id = new.skill_id and status = 'active') then
    raise exception 'A catalog item can only reference an active skill from the catalog.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_active_skill before insert or update on public.certification_skills for each row execute function public.guard_catalog_skill_active();
create trigger guard_active_skill before insert or update on public.learning_item_skills for each row execute function public.guard_catalog_skill_active();
create trigger guard_active_skill before insert or update on public.project_skills for each row execute function public.guard_catalog_skill_active();

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Arena challenges tagged with canonical skills. Derived deterministically IN THE DATABASE (so every existing and future challenge is covered):
-- the linked skill of its skill_area_key, plus each free-text tag that EXACTLY matches an active skill's name or alias. Nothing fuzzy.
create table public.arena_challenge_skills (
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  source text not null check (source in ('AREA', 'TAG')),
  primary key (challenge_id, skill_id)
);
create index arena_challenge_skills_by_skill on public.arena_challenge_skills (skill_id);

create function public.tag_arena_challenge_skills(p_challenge uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ch record;
begin
  select id, skill_area_key, skill_tags into ch from public.arena_challenges where id = p_challenge;
  if not found then return; end if;
  delete from public.arena_challenge_skills where challenge_id = p_challenge;
  insert into public.arena_challenge_skills (challenge_id, skill_id, source)
    select p_challenge, a.skill_id, 'AREA' from public.arena_skill_areas a
    join public.skills s on s.id = a.skill_id and s.status = 'active'
    where ch.skill_area_key is not null and a.area_key = ch.skill_area_key and a.skill_id is not null
  on conflict do nothing;
  insert into public.arena_challenge_skills (challenge_id, skill_id, source)
    select p_challenge, s.id, 'TAG' from unnest(coalesce(ch.skill_tags, '{}')) as t(tag)
    join lateral (select public.normalize_skill_text(t.tag) as n) q on true
    join public.skills s on s.status = 'active' and (
      public.normalize_skill_text(s.name) = q.n or exists (select 1 from public.skill_aliases al where al.skill_id = s.id and al.alias = q.n)
    )
  on conflict do nothing;
end $$;
revoke execute on function public.tag_arena_challenge_skills(uuid) from public, anon, authenticated;
grant execute on function public.tag_arena_challenge_skills(uuid) to service_role;

create function public.arena_challenge_tag_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.tag_arena_challenge_skills(new.id);
  return null;
end $$;
revoke execute on function public.arena_challenge_tag_trigger() from public, anon, authenticated;
create trigger tag_skills after insert or update of skill_tags, skill_area_key on public.arena_challenges for each row execute function public.arena_challenge_tag_trigger();

-- Tags that clearly belong to one canonical skill (taxonomy curation — PRODUCT-TEAM REVIEW). Anything ambiguous (parsing, JSON, formatting…) is left unmapped.
insert into public.skill_aliases (alias, skill_id)
select a.alias, s.id from (values
  ('dfs','SKILL_GRAPH_ALGORITHMS'),('bfs','SKILL_GRAPH_ALGORITHMS'),('cycle detection','SKILL_GRAPH_ALGORITHMS'),('shortest path','SKILL_GRAPH_ALGORITHMS'),('shortest paths','SKILL_GRAPH_ALGORITHMS'),
  ('topological sort','SKILL_GRAPH_ALGORITHMS'),('minimum spanning tree','SKILL_GRAPH_ALGORITHMS'),('graphs','SKILL_GRAPH_ALGORITHMS'),
  ('binary trees','SKILL_DATA_STRUCTURES'),('binary tree','SKILL_DATA_STRUCTURES'),('trees','SKILL_DATA_STRUCTURES'),('tree traversal','SKILL_DATA_STRUCTURES'),('linked list','SKILL_DATA_STRUCTURES'),
  ('linked lists','SKILL_DATA_STRUCTURES'),('stack','SKILL_DATA_STRUCTURES'),('stacks','SKILL_DATA_STRUCTURES'),('queue','SKILL_DATA_STRUCTURES'),('queues','SKILL_DATA_STRUCTURES'),
  ('hash table','SKILL_DATA_STRUCTURES'),('hash tables','SKILL_DATA_STRUCTURES'),('hashing','SKILL_DATA_STRUCTURES'),('heap','SKILL_DATA_STRUCTURES'),('heaps','SKILL_DATA_STRUCTURES'),
  ('array','SKILL_DATA_STRUCTURES'),('arrays','SKILL_DATA_STRUCTURES'),
  ('sorting','SKILL_ALGORITHMS'),('searching','SKILL_ALGORITHMS'),('binary search','SKILL_ALGORITHMS'),('dynamic programming','SKILL_ALGORITHMS'),('greedy','SKILL_ALGORITHMS'),
  ('divide and conquer','SKILL_ALGORITHMS'),('recursion','SKILL_ALGORITHMS'),('backtracking','SKILL_ALGORITHMS'),('two pointers','SKILL_ALGORITHMS'),('sliding window','SKILL_ALGORITHMS'),
  ('sweep line','SKILL_ALGORITHMS'),('intervals','SKILL_ALGORITHMS'),
  ('aggregation','SKILL_SQL'),('joins','SKILL_SQL'),('group by','SKILL_SQL'),('window functions','SKILL_SQL'),('subqueries','SKILL_SQL'),
  ('locks','SKILL_OPERATING_SYSTEMS'),('race conditions','SKILL_OPERATING_SYSTEMS'),('threading','SKILL_OPERATING_SYSTEMS'),('synchronization','SKILL_OPERATING_SYSTEMS'),
  ('concurrency','SKILL_OPERATING_SYSTEMS'),('deadlock','SKILL_OPERATING_SYSTEMS'),('deadlocks','SKILL_OPERATING_SYSTEMS'),('multithreading','SKILL_OPERATING_SYSTEMS'),('threads','SKILL_OPERATING_SYSTEMS'),
  ('string manipulation','SKILL_PROGRAMMING_FUNDAMENTALS'),('conditionals','SKILL_PROGRAMMING_FUNDAMENTALS'),('loops','SKILL_PROGRAMMING_FUNDAMENTALS')
) a(alias, skill_key) join public.skills s on s.key = a.skill_key
on conflict (alias) do nothing;

-- Tag every existing challenge.
do $$ declare c record; begin for c in select id from public.arena_challenges loop perform public.tag_arena_challenge_skills(c.id); end loop; end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Carry over the two certifications already curated in skill_area_resources (provider taken from the title / URL it states; difficulty and cost
-- unstated -> NULL; relevance OPTIONAL, the weakest claim). skill_area_resources itself is not changed.
insert into public.certification_catalog (name, provider, url)
select r.title, case when r.title ilike 'Microsoft%' then 'Microsoft' when r.url ilike '%grow.google%' then 'Google' end, r.url
from public.skill_area_resources r where r.kind = 'certification' and r.active and case when r.title ilike 'Microsoft%' then 'Microsoft' when r.url ilike '%grow.google%' then 'Google' end is not null
on conflict (provider, name) do nothing;
insert into public.certification_skills (certification_id, skill_id)
select c.id, a.skill_id from public.skill_area_resources r
join public.certification_catalog c on c.name = r.title
join public.arena_skill_areas a on a.role_key = r.role_key and a.area_key = r.area_key and a.skill_id is not null
where r.kind = 'certification' on conflict do nothing;
insert into public.certification_careers (certification_id, career_id, relevance)
select c.id, ca.id, 'OPTIONAL' from public.skill_area_resources r
join public.certification_catalog c on c.name = r.title
join public.careers ca on ca.key = replace(r.role_key, '_', '-')
where r.kind = 'certification' on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Authority: readable by anyone (curated public information); written only by the service role.
alter table public.certification_catalog enable row level security;
alter table public.certification_skills enable row level security;
alter table public.certification_careers enable row level security;
alter table public.learning_catalog enable row level security;
alter table public.learning_item_skills enable row level security;
alter table public.project_catalog enable row level security;
alter table public.project_skills enable row level security;
alter table public.arena_challenge_skills enable row level security;
create policy certification_catalog_read on public.certification_catalog for select using (is_active);
create policy certification_skills_read on public.certification_skills for select using (true);
create policy certification_careers_read on public.certification_careers for select using (true);
create policy learning_catalog_read on public.learning_catalog for select using (is_active);
create policy learning_item_skills_read on public.learning_item_skills for select using (true);
-- Projects: only live, general entries are public. A COLLEGE project or a student's AI recommendation is read through the server.
create policy project_catalog_read on public.project_catalog for select using (status = 'ACTIVE' and source in ('CAPABILIO', 'MENTOR'));
create policy project_skills_read on public.project_skills for select using (exists (select 1 from public.project_catalog p where p.id = project_id and p.status = 'ACTIVE' and p.source in ('CAPABILIO', 'MENTOR')));
create policy arena_challenge_skills_read on public.arena_challenge_skills for select using (true);
revoke insert, update, delete, truncate on public.certification_catalog, public.certification_skills, public.certification_careers, public.learning_catalog,
  public.learning_item_skills, public.project_catalog, public.project_skills, public.arena_challenge_skills from anon, authenticated;
