-- Data Engineer (IT-05) as the Big Data Analytics entry role. Additive only: the role row and its four SQL areas from 104/107
-- (transformation, queries, data-changes, debugging on sql_workspace) are untouched.
-- Three new areas run on pipeline_workspace (Pipeline Lab, lib/workplace/pipeline): the student edits a pipeline spec and the server simulates daily
-- runs over synthetic batches. It models Spark / Airflow / dbt ideas; no cluster or scheduler runs.

update public.arena_domain_roles
set display_name = 'Data Engineer (Big Data)',
    match_keywords = (
      select array_agg(distinct k order by k)
      from unnest(match_keywords || array[
        'big data engineer', 'big data analyst', 'big data developer', 'big data analytics', 'big data',
        'spark developer', 'spark engineer', 'pyspark developer', 'hadoop', 'hadoop developer', 'hadoop engineer',
        'hive developer', 'databricks engineer', 'airflow developer', 'dbt developer', 'etl pipeline engineer'
      ]) as k
    )
where role_key = 'data-engineer-sql';

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('data-engineer-sql', 'pipelines', 'Pipelines and incremental loads', 'data_engineer.pipelines', 'pipeline_workspace', true, 5, 'pipeline.gen.v1', 'pipeline.grade.v1'),
  ('data-engineer-sql', 'data-quality', 'Data quality and schema changes', 'data_engineer.data_quality', 'pipeline_workspace', true, 6, 'pipeline.gen.v1', 'pipeline.grade.v1'),
  ('data-engineer-sql', 'partitioning-and-storage', 'Partitioning and storage layout', 'data_engineer.partitioning_and_storage', 'pipeline_workspace', true, 7, 'pipeline.gen.v1', 'pipeline.grade.v1')
on conflict (role_key, area_key) do nothing;
