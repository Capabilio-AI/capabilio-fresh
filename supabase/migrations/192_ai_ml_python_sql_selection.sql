-- AI / ML Engineer (IT-07): three more skill areas from the entry-level framework. Plain Python and SQL for ML data each reuse a shared workstation
-- (code_workspace: lib/workplace/ml-engineer/python-problems.ts; sql_workspace on the BrightCart warehouse: sql-templates.ts and world.ts), and algorithm
-- selection runs on the ml_workspace notebook (selection.ts). Additive only; area keys are prefixed mle- so no other role can share them.
insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('ai-ml-engineer', 'mle-algorithm-selection', 'Algorithm selection and tuning', 'ai_ml.algorithm_selection', 'ml_workspace', true, 14, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'mle-python', 'Python for ML', 'ai_ml.python', 'code_workspace', true, 15, 'code.gen.v1', 'code.grade.v1'),
  ('ai-ml-engineer', 'mle-data-sql', 'SQL for ML data', 'ai_ml.data_sql', 'sql_workspace', true, 16, 'sql.gen.v1', 'sql.grade.v1')
on conflict (role_key, area_key) do nothing;

update public.arena_skill_areas a set skill_id = s.id
from (values
  ('mle-algorithm-selection', 'SKILL_MACHINE_LEARNING'),
  ('mle-python', 'SKILL_PYTHON'),
  ('mle-data-sql', 'SKILL_SQL')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'ai-ml-engineer' and a.area_key = m.area_key and a.skill_id is null;

insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'ai-ml-engineer', m.area_key, s.id
from (values
  ('mle-algorithm-selection', 'SKILL_MODEL_EVALUATION_AND_METRICS'),
  ('mle-python', 'SKILL_MACHINE_LEARNING'),
  ('mle-data-sql', 'SKILL_DATA_WRANGLING_WITH_PANDAS')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
