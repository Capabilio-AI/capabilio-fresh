-- AI / ML Engineer (IT-07): five more skill areas covering the rest of the model lifecycle. Four run on the existing ml_workspace notebook (numbers computed on
-- the server from the generated data, tickets in lib/workplace/ml-engineer: features.ts, tracking.ts, monitoring.ts, neural.ts) and one on the shared config
-- workstation (lib/workplace/ml-engineer/devops-templates.ts). Additive only; the role, its keywords and the eight earlier areas are untouched.
insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('ai-ml-engineer', 'ml-feature-engineering', 'Feature engineering', 'ai_ml.feature_engineering', 'ml_workspace', true, 9, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'experiment-tracking', 'Experiment tracking', 'ai_ml.experiment_tracking', 'ml_workspace', true, 10, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'drift-monitoring', 'Drift and monitoring', 'ai_ml.drift_monitoring', 'ml_workspace', true, 11, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'neural-networks', 'Neural-network basics', 'ai_ml.neural_networks', 'ml_workspace', true, 12, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'mlops-config', 'MLOps configuration', 'ai_ml.mlops_config', 'devops_workspace', true, 13, 'devops.gen.v1', 'devops.grade.v1')
on conflict (role_key, area_key) do nothing;

-- link each new area to the canonical skill it proves (see 149_ai_ml_area_skill_links.sql); a skill key that does not exist simply links nothing
update public.arena_skill_areas a set skill_id = s.id
from (values
  ('ml-feature-engineering', 'SKILL_MACHINE_LEARNING'),
  ('experiment-tracking', 'SKILL_MODEL_EVALUATION_AND_METRICS'),
  ('drift-monitoring', 'SKILL_MONITORING_AND_OBSERVABILITY'),
  ('neural-networks', 'SKILL_DEEP_LEARNING'),
  ('mlops-config', 'SKILL_MODEL_DEPLOYMENT_BASICS')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'ai-ml-engineer' and a.area_key = m.area_key and a.skill_id is null;

insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'ai-ml-engineer', m.area_key, s.id
from (values
  ('ml-feature-engineering', 'SKILL_PYTHON'),
  ('experiment-tracking', 'SKILL_STATISTICS'),
  ('drift-monitoring', 'SKILL_STATISTICS'),
  ('neural-networks', 'SKILL_PYTHON'),
  ('mlops-config', 'SKILL_MACHINE_LEARNING')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
