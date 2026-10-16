-- Cloud Engineer role (AWS). Same editor and checks as DevOps: the learner edits IAM policies and CloudFormation templates, the server checks the
-- text against rules (see lib/workplace/devops). The career row already exists in the catalog; this adds the role and its skill areas.
insert into public.careers (key, name, category, description) values
  ('cloud-engineer', 'Cloud Engineer', 'Cloud', 'Designs and secures cloud infrastructure: access, networks, storage, serverless and reliability.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('cloud-engineer', 'Cloud Engineer', 'Cloud Computing', array['cloud engineer', 'cloud architect', 'cloud developer', 'cloud administrator', 'aws engineer', 'aws developer', 'azure engineer', 'gcp engineer', 'solutions architect', 'cloud'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('cloud-engineer', 'iam-security', 'Access and IAM', 'cloud.iam_security', 'devops_workspace', true, 1, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-engineer', 'networking', 'Cloud networking', 'cloud.networking', 'devops_workspace', true, 2, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-engineer', 'storage-and-data', 'Storage and databases', 'cloud.storage_and_data', 'devops_workspace', true, 3, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-engineer', 'serverless-and-compute', 'Serverless and compute', 'cloud.serverless_and_compute', 'devops_workspace', true, 4, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-engineer', 'cost-and-reliability', 'Cost and reliability', 'cloud.cost_and_reliability', 'devops_workspace', true, 5, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-engineer', 'cloud-debugging', 'Debugging cloud configuration', 'cloud.cloud_debugging', 'devops_workspace', true, 6, 'devops.gen.v1', 'devops.grade.v1')
on conflict (role_key, area_key) do nothing;
