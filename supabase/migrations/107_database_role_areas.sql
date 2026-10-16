-- More skill areas for the database roles (see 104): changing data and debugging for the SQL roles, dashboards for the BI Developer.
-- Tickets are served per area, so these only take effect once the tickets for them exist in the code (they do).
insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('sql-developer', 'data-changes', 'Changing data', 'sql_developer.data_changes', 'sql_workspace', true, 4, 'sql.gen.v1', 'sql.grade.v1'),
  ('sql-developer', 'debugging', 'SQL debugging', 'sql_developer.debugging', 'sql_workspace', true, 5, 'sql.gen.v1', 'sql.grade.v1'),
  ('bi-developer', 'dashboard', 'Dashboards', 'bi_developer.dashboard', 'dashboard_workspace', true, 3, 'dashboard.gen.v1', 'dashboard.grade.v1'),
  ('bi-developer', 'debugging', 'SQL debugging', 'bi_developer.debugging', 'sql_workspace', true, 4, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-engineer-sql', 'data-changes', 'Changing data', 'data_engineer.data_changes', 'sql_workspace', true, 3, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-engineer-sql', 'debugging', 'SQL debugging', 'data_engineer.debugging', 'sql_workspace', true, 4, 'sql.gen.v1', 'sql.grade.v1')
on conflict (role_key, area_key) do nothing;
