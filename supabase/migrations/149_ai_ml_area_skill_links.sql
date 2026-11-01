-- AI/ML Engineer: link every ml_workspace area to the canonical skills it actually proves. Until now only Data Analyst areas were linked
-- (047), so an AI/ML workstation pass raised ELO but wrote no skill evidence and the skill graph / readiness never moved.
-- An area has one PRIMARY skill (arena_skill_areas.skill_id, also used to tag challenges) and optional extra skills it also proves.
create table if not exists public.arena_area_extra_skills (
  role_key text not null,
  area_key text not null,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key (role_key, area_key, skill_id),
  foreign key (role_key, area_key) references public.arena_skill_areas (role_key, area_key) on delete cascade
);
alter table public.arena_area_extra_skills enable row level security; -- read by the server (service role) only

update public.arena_skill_areas a set skill_id = s.id
from (values
  ('data-preparation', 'SKILL_DATA_WRANGLING_WITH_PANDAS'),
  ('model-training', 'SKILL_MACHINE_LEARNING'),
  ('evaluation', 'SKILL_MODEL_EVALUATION_AND_METRICS'),
  ('pipeline-debugging', 'SKILL_PYTHON'),
  ('ml-fundamentals', 'SKILL_OPTIMIZATION_AND_GRADIENT_DESCENT'),
  ('model-deployment', 'SKILL_MODEL_DEPLOYMENT_BASICS'),
  ('error-analysis', 'SKILL_MODEL_EVALUATION_AND_METRICS'),
  ('training-hygiene', 'SKILL_OVERFITTING_AND_REGULARIZATION')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'ai-ml-engineer' and a.area_key = m.area_key;

insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'ai-ml-engineer', m.area_key, s.id
from (values
  ('data-preparation', 'SKILL_PYTHON'),
  ('model-training', 'SKILL_PYTHON'),
  ('evaluation', 'SKILL_STATISTICS'),
  ('pipeline-debugging', 'SKILL_MACHINE_LEARNING'),
  ('ml-fundamentals', 'SKILL_STATISTICS'),
  ('model-deployment', 'SKILL_SOFTWARE_ENGINEERING'),
  ('error-analysis', 'SKILL_MACHINE_LEARNING'),
  ('training-hygiene', 'SKILL_MACHINE_LEARNING')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
