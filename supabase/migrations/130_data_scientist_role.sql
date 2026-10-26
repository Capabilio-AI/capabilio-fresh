-- Data Scientist role (IT-08). Inference, experimentation and communicating results, on existing tools only:
--   statistics_workspace (exploratory analysis) and investigation_workspace (data storytelling) on the BrightCart company data
--   (lib/workplace/data-science/world.ts), ml_workspace notebook tickets for experiment design, feature engineering, model building and
--   model evaluation (lib/workplace/data-science/ml-templates.ts). Answers are computed on the server; hidden test labels never leave it.
-- Until now "data scientist" / "applied scientist" matched the AI / ML Engineer by keyword, so they are moved here.
insert into public.careers (key, name, category, description) values
  ('data-scientist', 'Data Scientist', 'Data', 'Explores data, designs and reads experiments, builds and evaluates models, and turns the results into decisions people can trust.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('data-scientist', 'Data Scientist', 'Data Science', array['data scientist', 'applied scientist', 'data science', 'junior data scientist', 'associate data scientist', 'decision scientist', 'product data scientist', 'statistician', 'experimentation analyst', 'a/b testing'])
on conflict (role_key) do nothing;

-- the AI / ML Engineer keeps its engineering keywords only (array_remove is a no-op when the value is absent, so this is safe to re-run)
update public.arena_domain_roles
   set match_keywords = array_remove(array_remove(match_keywords, 'data scientist'), 'applied scientist')
 where role_key = 'ai-ml-engineer';

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('data-scientist', 'exploratory-analysis', 'Exploratory analysis', 'data_science.exploratory_analysis', 'statistics_workspace', true, 1, 'statistics.gen.v1', 'statistics.grade.v1'),
  ('data-scientist', 'experiment-design', 'Experiment design and A/B tests', 'data_science.experiment_design', 'ml_workspace', true, 2, 'ml.gen.v1', 'ml.grade.v1'),
  ('data-scientist', 'feature-engineering', 'Feature engineering', 'data_science.feature_engineering', 'ml_workspace', true, 3, 'ml.gen.v1', 'ml.grade.v1'),
  ('data-scientist', 'model-building', 'Building predictive models', 'data_science.model_building', 'ml_workspace', true, 4, 'ml.gen.v1', 'ml.grade.v1'),
  ('data-scientist', 'model-evaluation', 'Evaluating models', 'data_science.model_evaluation', 'ml_workspace', true, 5, 'ml.gen.v1', 'ml.grade.v1'),
  ('data-scientist', 'data-storytelling', 'Data storytelling', 'data_science.data_storytelling', 'investigation_workspace', true, 6, 'investigation.gen.v1', 'investigation.grade.v1')
on conflict (role_key, area_key) do nothing;
