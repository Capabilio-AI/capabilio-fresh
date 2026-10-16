-- New ways of working for the Data Analyst: fixing broken queries, investigating a drop in the numbers, and handling a data incident.
-- Debugging uses the SQL workspace; the other two use the new investigation workspace. Incidents and investigations are served only to people
-- with enough experience (see lib/workplace/areas.ts); the rotation simply leaves them out until then.
insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('data-analyst', 'debugging', 'SQL debugging', 'data_analyst.debugging', 'sql_workspace', true, 7, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-analyst', 'investigation', 'Data investigation', 'data_analyst.investigation', 'investigation_workspace', true, 8, 'investigation.gen.v1', 'investigation.grade.v1'),
  ('data-analyst', 'incident', 'Production incidents', 'data_analyst.incident', 'investigation_workspace', true, 9, 'investigation.gen.v1', 'investigation.grade.v1')
on conflict (role_key, area_key) do nothing;
