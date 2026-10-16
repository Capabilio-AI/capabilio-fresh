-- Programming Languages role. The user writes one function in Python or JavaScript; it runs in their browser on every case and the server
-- compares what it returned with its own answers (see lib/workplace/code). More languages (Java, C, C++) need a server-side runner.
insert into public.careers (key, name, category, description) values
  ('programming-languages', 'Programming Languages', 'Software', 'Writes correct, efficient code in a language of choice: strings, data structures, algorithms and finding bugs.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('programming-languages', 'Programming Languages', 'Programming', array['python developer', 'javascript developer', 'software engineer', 'software developer', 'programmer', 'java developer', 'c++ developer', 'c developer', 'coding', 'programming'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('programming-languages', 'fundamentals', 'Language fundamentals', 'programming.fundamentals', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('programming-languages', 'data-structures', 'Data structures', 'programming.data_structures', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('programming-languages', 'algorithms', 'Algorithms', 'programming.algorithms', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('programming-languages', 'debugging', 'Debugging code', 'programming.debugging', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1')
on conflict (role_key, area_key) do nothing;
