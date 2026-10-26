-- MCA-01 Application Developer role: an MCA fresher's first job, small full-stack features. It reuses four existing workstations with its own area keys
-- and its own templates (lib/workplace/application-developer): functions, API handlers, UI state and debugging on the code workstation (the learner's
-- function runs in their browser and the server compares the outputs), forms on the frontend workstation (HTML parsed and checked, never run), data
-- access on the SQL workstation against the fictional Kaarya app database, and build/config files on the config workstation (text checked, nothing run).
insert into public.careers (key, name, category, description) values
  ('application-developer', 'Application Developer', 'Software', 'Builds small features across an application: logic, request handling, forms, UI state, database queries and build configuration.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('application-developer', 'Application Developer', 'Application Development', array['application developer', 'app developer', 'applications developer', 'full stack developer', 'full-stack developer', 'fullstack developer', 'full stack engineer', 'web application developer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('application-developer', 'functions-and-logic', 'Functions and logic', 'appdev.functions_and_logic', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('application-developer', 'api-handlers', 'API handlers', 'appdev.api_handlers', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('application-developer', 'ui-forms', 'UI forms', 'appdev.ui_forms', 'frontend_workspace', true, 3, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('application-developer', 'ui-state', 'UI state', 'appdev.ui_state', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1'),
  ('application-developer', 'data-access', 'Data access', 'appdev.data_access', 'sql_workspace', true, 5, 'sql.gen.v1', 'sql.grade.v1'),
  ('application-developer', 'build-and-config', 'Build and configuration', 'appdev.build_and_config', 'devops_workspace', true, 6, 'devops.gen.v1', 'devops.grade.v1'),
  ('application-developer', 'app-debugging', 'Debugging', 'appdev.app_debugging', 'code_workspace', true, 7, 'code.gen.v1', 'code.grade.v1')
on conflict (role_key, area_key) do nothing;
