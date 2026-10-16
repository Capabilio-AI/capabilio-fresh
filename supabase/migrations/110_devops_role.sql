-- DevOps Engineer role. The user edits configuration files (Dockerfile, CI workflow, Kubernetes, Compose, Terraform); the server checks the text
-- against rules and nothing is executed (see lib/workplace/devops). Tickets are written by the AI and proved fair before they are served.
insert into public.careers (key, name, category, description) values
  ('devops-engineer', 'DevOps Engineer', 'Software', 'Builds and runs the pipeline from code to production: containers, CI/CD, Kubernetes and infrastructure as code.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('devops-engineer', 'DevOps Engineer', 'DevOps', array['devops', 'site reliability', 'sre', 'platform engineer', 'release engineer', 'build engineer', 'infrastructure engineer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('devops-engineer', 'containers', 'Containers and Dockerfiles', 'devops.containers', 'devops_workspace', true, 1, 'devops.gen.v1', 'devops.grade.v1'),
  ('devops-engineer', 'ci-cd', 'CI/CD pipelines', 'devops.ci_cd', 'devops_workspace', true, 2, 'devops.gen.v1', 'devops.grade.v1'),
  ('devops-engineer', 'kubernetes', 'Kubernetes', 'devops.kubernetes', 'devops_workspace', true, 3, 'devops.gen.v1', 'devops.grade.v1'),
  ('devops-engineer', 'infrastructure-as-code', 'Infrastructure as code', 'devops.infrastructure_as_code', 'devops_workspace', true, 4, 'devops.gen.v1', 'devops.grade.v1'),
  ('devops-engineer', 'config-debugging', 'Debugging configuration', 'devops.config_debugging', 'devops_workspace', true, 5, 'devops.gen.v1', 'devops.grade.v1')
on conflict (role_key, area_key) do nothing;
