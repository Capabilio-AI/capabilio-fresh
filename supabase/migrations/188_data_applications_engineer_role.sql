-- MCA-03 Database and Data Applications Engineer role: schema changes, reports and data fixes as SQL on the Kaarya app database (the same fictional
-- database as the Application Developer, with this role's own tickets in lib/workplace/data-applications), plus pagination and row-merging helpers on
-- the code workstation (the learner's function runs in their browser and the server compares the outputs).
insert into public.careers (key, name, category, description) values
  ('data-applications-engineer', 'Database and Data Applications Engineer', 'Software', 'Works on the data side of an application: schema changes, report queries, safe data fixes, imports and data-layer code.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('data-applications-engineer', 'Database and Data Applications Engineer', 'Data Applications', array['data applications engineer', 'database applications engineer', 'database and data applications', 'data application developer', 'database application developer', 'data applications developer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('data-applications-engineer', 'dda-schema-design', 'Schema design', 'dataapps.schema_design', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-applications-engineer', 'dda-reports', 'Report queries', 'dataapps.reports', 'sql_workspace', true, 2, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-applications-engineer', 'dda-data-fixes', 'Data fixes and imports', 'dataapps.data_fixes', 'sql_workspace', true, 3, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-applications-engineer', 'dda-data-layer-logic', 'Data-layer logic', 'dataapps.data_layer_logic', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1')
on conflict (role_key, area_key) do nothing;
