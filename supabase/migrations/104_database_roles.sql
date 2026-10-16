-- Database roles for the Workplace: SQL Developer, BI Developer, Database Administrator, Data Engineer (SQL-first).
-- They work in the same fictional company as the Data Analyst, on real PostgreSQL. Each role has skill areas; a ticket belongs to one area.
-- A role needs a career row too: that is where its Arena rating (ELO) is kept.

insert into public.careers (key, name, category, description) values
  ('sql-developer', 'SQL Developer', 'Data', 'Writes queries, stored functions, triggers and schema changes for application databases.'),
  ('bi-developer', 'BI Developer', 'Data', 'Builds reporting queries, views and pre-computed tables that dashboards run on.'),
  ('database-admin', 'Database Administrator', 'Data', 'Keeps databases safe, correct and fast: access, integrity, indexes and maintenance.'),
  ('data-engineer-sql', 'Data Engineer', 'Data', 'Moves and shapes data with SQL: loads, merges, deduplication and transformations.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('sql-developer', 'SQL Developer', 'SQL Development', array['sql developer', 'database developer', 'plsql developer', 'pl sql developer', 't sql developer', 'tsql developer', 'mysql developer', 'postgresql developer', 'postgres developer', 'sql programmer']),
  ('bi-developer', 'BI Developer', 'Business Intelligence', array['bi developer', 'business intelligence developer', 'reporting developer', 'power bi developer', 'etl developer', 'sql bi developer']),
  ('database-admin', 'Database Administrator', 'Database Administration', array['dba', 'database administrator', 'database admin', 'oracle dba', 'sql server dba', 'mysql dba', 'postgresql dba', 'postgres dba', 'database engineer']),
  ('data-engineer-sql', 'Data Engineer', 'Data Engineering', array['data engineer', 'data engineering', 'etl engineer', 'analytics engineer', 'data pipeline engineer', 'big data engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('sql-developer', 'queries', 'Advanced queries', 'sql_developer.queries', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1'),
  ('sql-developer', 'programmability', 'Functions, procedures and triggers', 'sql_developer.programmability', 'sql_workspace', true, 2, 'sql.gen.v1', 'sql.grade.v1'),
  ('sql-developer', 'schema', 'Schema design and changes', 'sql_developer.schema', 'sql_workspace', true, 3, 'sql.gen.v1', 'sql.grade.v1'),
  ('bi-developer', 'queries', 'Reporting queries', 'bi_developer.queries', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1'),
  ('bi-developer', 'views', 'Views and pre-computed tables', 'bi_developer.views', 'sql_workspace', true, 2, 'sql.gen.v1', 'sql.grade.v1'),
  ('database-admin', 'security', 'Access and security', 'database_admin.security', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1'),
  ('database-admin', 'integrity', 'Data integrity', 'database_admin.integrity', 'sql_workspace', true, 2, 'sql.gen.v1', 'sql.grade.v1'),
  ('database-admin', 'performance', 'Indexes and performance', 'database_admin.performance', 'sql_workspace', true, 3, 'sql.gen.v1', 'sql.grade.v1'),
  ('database-admin', 'maintenance', 'Maintenance and cleanup', 'database_admin.maintenance', 'sql_workspace', true, 4, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-engineer-sql', 'transformation', 'Loading and transforming data', 'data_engineer.transformation', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1'),
  ('data-engineer-sql', 'queries', 'Analytical SQL', 'data_engineer.queries', 'sql_workspace', true, 2, 'sql.gen.v1', 'sql.grade.v1')
on conflict (role_key, area_key) do nothing;
