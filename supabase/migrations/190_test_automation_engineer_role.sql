-- MCA-05 Software Test Automation Engineer role: the helpers and pipeline around an automated test suite. Test data, boundary values, result
-- summaries and flaky-test detection run on the code workstation (the learner's function runs in their browser and the server compares the outputs);
-- CI test gates use the config workstation (workflow text checked against rules, nothing runs). Tickets: lib/workplace/test-automation.
insert into public.careers (key, name, category, description) values
  ('test-automation-engineer', 'Software Test Automation Engineer', 'Software', 'Automates software testing: test data, boundary cases, result analysis, flaky-test handling and CI test gates.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('test-automation-engineer', 'Software Test Automation Engineer', 'Test Automation', array['test automation engineer', 'software test automation', 'automation test engineer', 'sdet', 'software development engineer in test', 'test automation developer', 'automation tester'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('test-automation-engineer', 'sta-test-data', 'Test data and boundaries', 'testautomation.test_data', 'code_workspace', true, 1, 'code.gen.v1', 'code.grade.v1'),
  ('test-automation-engineer', 'sta-report-analysis', 'Test report analysis', 'testautomation.report_analysis', 'code_workspace', true, 2, 'code.gen.v1', 'code.grade.v1'),
  ('test-automation-engineer', 'sta-flaky-tests', 'Flaky tests', 'testautomation.flaky_tests', 'code_workspace', true, 3, 'code.gen.v1', 'code.grade.v1'),
  ('test-automation-engineer', 'sta-ci-test-gates', 'CI test gates', 'testautomation.ci_test_gates', 'devops_workspace', true, 4, 'devops.gen.v1', 'devops.grade.v1')
on conflict (role_key, area_key) do nothing;

-- link each area to the canonical skill it proves, so a verified pass writes skill evidence (see 149_ai_ml_area_skill_links.sql)
update public.arena_skill_areas a set skill_id = s.id
from (values
  ('sta-test-data', 'SKILL_PYTHON'),
  ('sta-report-analysis', 'SKILL_PYTHON'),
  ('sta-flaky-tests', 'SKILL_PYTHON')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'test-automation-engineer' and a.area_key = m.area_key and a.skill_id is null;
