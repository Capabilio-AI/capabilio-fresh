-- AI / ML Engineer (IT-07): three more skill areas on the existing ml_workspace notebook. Additive only: the role, its keywords and the five areas
-- from 108_ai_ml_role.sql are untouched. Tickets live in lib/workplace/ml-engineer/; all are numbers checked within a tolerance, computed on the server
-- from the generated data, so no grader changes.
insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('ai-ml-engineer', 'model-deployment', 'Model deployment basics', 'ai_ml.model_deployment', 'ml_workspace', true, 6, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'error-analysis', 'Error analysis', 'ai_ml.error_analysis', 'ml_workspace', true, 7, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'training-hygiene', 'Training hygiene', 'ai_ml.training_hygiene', 'ml_workspace', true, 8, 'ml.gen.v1', 'ml.grade.v1')
on conflict (role_key, area_key) do nothing;
