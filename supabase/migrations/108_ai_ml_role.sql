-- AI / ML Engineer role. Tickets are notebook tasks: the user works in the browser and submits predictions or numbers,
-- which the server grades against answers it never sent out (see docs/role-ai-ml-spec.md). Feature engineering is not offered yet.
insert into public.careers (key, name, category, description) values
  ('ai-ml-engineer', 'AI / ML Engineer', 'Data', 'Prepares data, trains and evaluates models, and finds the mistakes that make a model look better than it is.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('ai-ml-engineer', 'AI / ML Engineer', 'Machine Learning', array['ai engineer', 'ml engineer', 'machine learning engineer', 'ai ml engineer', 'ai/ml engineer', 'data scientist', 'applied scientist', 'machine learning', 'deep learning engineer', 'nlp engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('ai-ml-engineer', 'data-preparation', 'Data preparation', 'ai_ml.data_preparation', 'ml_workspace', true, 1, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'model-training', 'Training models', 'ai_ml.model_training', 'ml_workspace', true, 2, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'evaluation', 'Evaluating models', 'ai_ml.evaluation', 'ml_workspace', true, 3, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'pipeline-debugging', 'Debugging ML pipelines', 'ai_ml.pipeline_debugging', 'ml_workspace', true, 4, 'ml.gen.v1', 'ml.grade.v1'),
  ('ai-ml-engineer', 'ml-fundamentals', 'ML fundamentals in NumPy', 'ai_ml.ml_fundamentals', 'ml_workspace', true, 5, 'ml.gen.v1', 'ml.grade.v1')
on conflict (role_key, area_key) do nothing;
