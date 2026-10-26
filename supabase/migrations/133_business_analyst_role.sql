-- Business Analyst role (MBA-01). Requirements, process maps and gap tables are filled in Business Docs Studio and checked by rules on the
-- server (lib/workplace/business-docs); metrics, reporting and SQL reuse the spreadsheet, dashboard and SQL tools on the Kaveri company data.
insert into public.careers (key, name, category, description) values
  ('business-analyst', 'Business Analyst', 'Business', 'Bridges business needs and technical teams using data and requirements.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('business-analyst', 'Business Analyst', 'Business Analysis', array['business analyst', 'business systems analyst', 'requirements analyst', 'process analyst', 'functional analyst', 'business analysis', 'business analytics'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('business-analyst', 'requirements', 'Requirements and user stories', 'business_analysis.requirements', 'business_docs_workspace', true, 1, 'business_docs.gen.v1', 'business_docs.grade.v1'),
  ('business-analyst', 'process-mapping', 'Process mapping and RACI', 'business_analysis.process_mapping', 'business_docs_workspace', true, 2, 'business_docs.gen.v1', 'business_docs.grade.v1'),
  ('business-analyst', 'gap-analysis', 'Gap analysis', 'business_analysis.gap_analysis', 'business_docs_workspace', true, 3, 'business_docs.gen.v1', 'business_docs.grade.v1'),
  ('business-analyst', 'business-metrics', 'KPIs, variance and ROI', 'business_analysis.business_metrics', 'spreadsheet_workspace', true, 4, 'spreadsheet.gen.v1', 'spreadsheet.grade.v1'),
  ('business-analyst', 'reporting', 'Reporting and dashboards', 'business_analysis.reporting', 'dashboard_workspace', true, 5, 'dashboard.gen.v1', 'dashboard.grade.v1'),
  ('business-analyst', 'data-queries', 'Querying business data', 'business_analysis.data_queries', 'sql_workspace', true, 6, 'sql.gen.v1', 'sql.grade.v1')
on conflict (role_key, area_key) do nothing;
