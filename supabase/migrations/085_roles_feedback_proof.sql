-- 085: free-text roles (aliases + AI-generated profiles), common-assessment status names, assessment feedback, proof of work,
-- provider traceability on questions, configurable starting rating.

-- ---- provenance on stored questions ------------------------------------------------------------------------------------
alter table public.assess_question_pool add column if not exists provider text, add column if not exists prompt_version text;

-- ---- onboarding: COMMON_ASSESSMENT_COMPLETE replaces GENERAL_..., ACTIVE folds into PROFILE_READY -------------------------
alter table public.student_onboarding drop constraint if exists student_onboarding_status_check;
update public.student_onboarding set status = 'COMMON_ASSESSMENT_COMPLETE' where status = 'GENERAL_ASSESSMENT_COMPLETE';
update public.student_onboarding set status = 'PROFILE_READY' where status = 'ACTIVE';
alter table public.student_onboarding add constraint student_onboarding_status_check
  check (status in ('ASSESSMENT_REQUIRED','COMMON_ASSESSMENT_COMPLETE','CAREER_ASSESSMENT_COMPLETE','PROFILE_READY'));

-- ---- roles: where a role came from, and the words students use for it ----------------------------------------------------
alter table public.careers
  add column if not exists status text not null default 'CURATED' check (status in ('CURATED','AI_GENERATED','REVIEWED')),
  add column if not exists provider text, add column if not exists model text, add column if not exists prompt_version text;

create extension if not exists pg_trgm;

create table public.career_aliases (
  alias text primary key,                       -- normalised: lower-case, single spaces, letters/digits only
  career_id uuid not null references public.careers(id) on delete cascade,
  source text not null check (source in ('SEED','STUDENT','AI')),
  uses int not null default 1,
  created_at timestamptz not null default now()
);
create index career_aliases_trgm on public.career_aliases using gin (alias gin_trgm_ops);
create index career_aliases_career on public.career_aliases (career_id);
alter table public.career_aliases enable row level security;
create policy "aliases readable" on public.career_aliases for select using (true);

-- seed: every career's name, key and the keywords Arena already uses
insert into public.career_aliases (alias, career_id, source)
select distinct a, c.id, 'SEED' from public.careers c,
  lateral (select lower(regexp_replace(c.name, '[^a-zA-Z0-9]+', ' ', 'g')) a
           union select lower(replace(c.key, '-', ' '))
           union select lower(regexp_replace(k, '[^a-zA-Z0-9]+', ' ', 'g'))
                 from public.arena_domain_roles r, unnest(r.match_keywords) k where r.role_key = c.key) x
where a <> '' on conflict do nothing;
insert into public.career_aliases (alias, career_id, source)
select v.alias, c.id, 'SEED' from (values
  ('devops','cloud-engineer'),('devops engineer','cloud-engineer'),('site reliability engineer','cloud-engineer'),('sre','cloud-engineer'),
  ('backend developer','software-engineer'),('software developer','software-engineer'),('sde','software-engineer'),('programmer','software-engineer'),
  ('web developer','full-stack-developer'),('frontend developer','full-stack-developer'),('mern developer','full-stack-developer'),
  ('machine learning engineer','ai-ml-engineer'),('ml engineer','ai-ml-engineer'),('ai engineer','ai-ml-engineer'),
  ('data science','data-scientist'),('security analyst','cybersecurity-analyst'),('infosec','cybersecurity-analyst'),('ethical hacker','cybersecurity-analyst'),
  ('product owner','product-manager'),('pm','product-manager'),('ux designer','product-designer'),('ui ux designer','product-designer'),
  ('bi analyst','data-analyst'),('analytics','data-analyst'),('business analytics','business-analyst')
) v(alias, key) join public.careers c on c.key = v.key on conflict do nothing;

-- ranked matches for a free-text query: trigram similarity against aliases, boosted by whole-word containment
create or replace function public.match_careers(p_query text, p_limit int default 5)
returns table (career_id uuid, key text, name text, status text, score real)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.key, c.name, c.status,
         max(greatest(similarity(a.alias, p_query),
                      case when p_query like '%' || a.alias || '%' and length(a.alias) >= 4 then 0.85 else 0 end,
                      case when a.alias like '%' || p_query || '%' and length(p_query) >= 4 then 0.7 else 0 end))::real as score
  from public.career_aliases a join public.careers c on c.id = a.career_id and c.is_active
  group by c.id, c.key, c.name, c.status
  having max(greatest(similarity(a.alias, p_query), case when p_query like '%' || a.alias || '%' and length(a.alias) >= 4 then 0.85 else 0 end,
                      case when a.alias like '%' || p_query || '%' and length(p_query) >= 4 then 0.7 else 0 end)) > 0.2
  order by 5 desc limit p_limit
$$;
revoke all on function public.match_careers(text, int) from public, anon, authenticated;

-- ---- assessment feedback (AI or template), one row per session and part ---------------------------------------------------
create table public.assessment_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assess_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  part text not null check (part in ('COMMON','CAREER')),
  body jsonb not null,
  source text not null check (source in ('AI','TEMPLATE')),
  provider text, model text, prompt_version text,
  created_at timestamptz not null default now(),
  unique (session_id, part)
);
alter table public.assessment_feedback enable row level security;
create policy "own feedback" on public.assessment_feedback for select using (student_id = auth.uid());

-- ---- proof of work -------------------------------------------------------------------------------------------------------
create table public.proof_of_work (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('PROJECT','CERTIFICATION','GITHUB','PORTFOLIO','ARENA','OTHER')),
  title text not null check (char_length(title) between 2 and 160),
  url text check (url is null or url ~* '^https?://'),
  skill_ids uuid[] not null default '{}',
  verification_status text not null default 'UNVERIFIED' check (verification_status in ('UNVERIFIED','VERIFIED','REJECTED')),
  verified_at timestamptz, verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index proof_of_work_student on public.proof_of_work (student_id, created_at desc);
alter table public.proof_of_work enable row level security;
create policy "own proof" on public.proof_of_work for select using (student_id = auth.uid());

-- evidence may now come from proof of work, and the snapshot trigger list grows with it
alter table public.student_skill_evidence drop constraint if exists student_skill_evidence_source_check;
alter table public.student_skill_evidence add constraint student_skill_evidence_source_check
  check (source in ('ASSESSMENT_GENERAL','ASSESSMENT_CAREER','ARENA','PROOF_OF_WORK'));
alter table public.career_skill_graph_snapshots drop constraint if exists career_skill_graph_snapshots_trigger_check;
alter table public.career_skill_graph_snapshots add constraint career_skill_graph_snapshots_trigger_check
  check (trigger in ('ASSESSMENT','ARENA','PROOF_OF_WORK'));

-- ---- starting rating lives in the rules table ----------------------------------------------------------------------------
alter table public.elo_rules add column if not exists start_rating int not null default 400;
alter table public.student_career_elo alter column rating drop default;

create or replace function public.apply_elo_event(
  p_student uuid, p_career uuid, p_source text, p_source_id uuid, p_correct boolean, p_reason text default null, p_scale numeric default 1.0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rule public.elo_rules%rowtype; v_start int;
  v_prev int; v_new int; v_change int; v_event public.elo_events%rowtype;
begin
  if p_scale is null or p_scale <= 0 then raise exception 'invalid_scale'; end if;
  select * into v_rule from public.elo_rules where source = p_source;
  if not found then raise exception 'no elo rule for source %', p_source; end if;
  select start_rating into v_start from public.elo_rules where source = 'ASSESSMENT';   -- one starting rating per role, whichever source touches it first

  insert into public.student_career_elo (student_id, career_id, rating) values (p_student, p_career, v_start) on conflict do nothing;
  select rating into v_prev from public.student_career_elo where student_id = p_student and career_id = p_career for update;

  select * into v_event from public.elo_events where source = p_source and source_id = p_source_id;
  if found then
    return jsonb_build_object('eventId', v_event.id, 'previous', v_event.previous_rating, 'change', v_event.change, 'newRating', v_event.new_rating, 'replayed', true);
  end if;

  v_change := round((case when p_correct then v_rule.correct_delta else v_rule.incorrect_delta end)
                    * v_rule.difficulty_multiplier * v_rule.performance_multiplier * p_scale);
  v_new := greatest(v_rule.min_rating, v_prev + v_change);
  v_change := v_new - v_prev;

  insert into public.elo_events (student_id, career_id, source, source_id, previous_rating, change, new_rating, reason)
  values (p_student, p_career, p_source, p_source_id, v_prev, v_change, v_new, p_reason) returning * into v_event;
  update public.student_career_elo set rating = v_new, updated_at = now() where student_id = p_student and career_id = p_career;
  return jsonb_build_object('eventId', v_event.id, 'previous', v_prev, 'change', v_change, 'newRating', v_new, 'replayed', false);
end $$;
revoke all on function public.apply_elo_event(uuid, uuid, text, uuid, boolean, text, numeric) from public, anon, authenticated;
