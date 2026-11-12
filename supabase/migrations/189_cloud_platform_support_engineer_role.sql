-- MCA-04 Cloud and Platform Support Engineer role: a support desk fresher fixing a customer's container image, Kubernetes manifests, IAM policy and
-- Compose file on the config workstation (text checked against rules, nothing built or applied), and triaging service logs on the code workstation
-- (the learner's function runs in their browser and the server compares the outputs). Tickets: lib/workplace/cloud-platform-support.
insert into public.careers (key, name, category, description) values
  ('cloud-platform-support-engineer', 'Cloud and Platform Support Engineer', 'Cloud Computing', 'Supports customers on a cloud platform: fixes container and Kubernetes configuration, access policies and reads service logs to find the failing part.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('cloud-platform-support-engineer', 'Cloud and Platform Support Engineer', 'Cloud Support', array['cloud support engineer', 'platform support engineer', 'cloud and platform support', 'cloud platform support', 'cloud support associate', 'cloud operations associate', 'technical support engineer cloud'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('cloud-platform-support-engineer', 'cps-container-fixes', 'Container fixes', 'cloudsupport.container_fixes', 'devops_workspace', true, 1, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-platform-support-engineer', 'cps-kubernetes-manifests', 'Kubernetes manifests', 'cloudsupport.kubernetes_manifests', 'devops_workspace', true, 2, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-platform-support-engineer', 'cps-access-and-secrets', 'Access and secrets', 'cloudsupport.access_and_secrets', 'devops_workspace', true, 3, 'devops.gen.v1', 'devops.grade.v1'),
  ('cloud-platform-support-engineer', 'cps-log-triage', 'Log triage', 'cloudsupport.log_triage', 'code_workspace', true, 4, 'code.gen.v1', 'code.grade.v1')
on conflict (role_key, area_key) do nothing;

-- link each area to the canonical skill it proves, so a verified pass writes skill evidence (see 149_ai_ml_area_skill_links.sql)
update public.arena_skill_areas a set skill_id = s.id
from (values
  ('cps-container-fixes', 'SKILL_CLOUD_COMPUTING'),
  ('cps-kubernetes-manifests', 'SKILL_KUBERNETES_ORCHESTRATION'),
  ('cps-access-and-secrets', 'SKILL_CLOUD_PLATFORMS'),
  ('cps-log-triage', 'SKILL_MONITORING_AND_OBSERVABILITY')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'cloud-platform-support-engineer' and a.area_key = m.area_key and a.skill_id is null;

insert into public.arena_area_extra_skills (role_key, area_key, skill_id)
select 'cloud-platform-support-engineer', m.area_key, s.id
from (values
  ('cps-log-triage', 'SKILL_PYTHON')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
on conflict do nothing;
