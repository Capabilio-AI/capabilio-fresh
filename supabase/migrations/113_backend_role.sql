-- Backend Developer role. The learner writes one function that models an API (requests in, responses out); it runs in their browser and the server
-- compares the answers with its own, exactly like the Programming Languages role (see lib/workplace/code). Tickets are written by the AI and proved fair.
insert into public.careers (key, name, category, description) values
  ('backend-developer', 'Backend Developer', 'Software', 'Builds the server side: APIs, validation, authentication, state, reliability and finding bugs in handlers.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('backend-developer', 'Backend Developer', 'Backend Development', array['backend', 'back end', 'back-end', 'api developer', 'api engineer', 'server-side', 'server side', 'node developer', 'node.js developer', 'django developer', 'spring developer', 'java backend', 'python backend'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('backend-developer', 'rest-api', 'REST APIs', 'backend.rest_api', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('backend-developer', 'auth-and-security', 'Authentication and security', 'backend.auth_and_security', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('backend-developer', 'data-and-state', 'Data and state', 'backend.data_and_state', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('backend-developer', 'error-handling', 'Errors and reliability', 'backend.error_handling', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1'),
  ('backend-developer', 'backend-debugging', 'Debugging backend code', 'backend.backend_debugging', 'code_workspace', true, 5, 'code.gen.v1', 'code.grade.v1')
on conflict (role_key, area_key) do nothing;
