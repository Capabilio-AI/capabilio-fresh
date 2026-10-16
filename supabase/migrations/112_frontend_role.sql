-- Frontend Developer role. The learner edits HTML and CSS; the server parses the files and checks structure, accessibility and styling against rules,
-- and never runs the page (see lib/workplace/frontend). Tickets are written by the AI and proved fair before they are served.
insert into public.careers (key, name, category, description) values
  ('frontend-developer', 'Frontend Developer', 'Software', 'Builds the part of a website people see and use: semantic HTML, CSS layout, responsive design, accessibility and forms.')
on conflict (key) do nothing;

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('frontend-developer', 'Frontend Developer', 'Frontend Development', array['frontend', 'front end', 'front-end', 'ui developer', 'ui engineer', 'web developer', 'react developer', 'angular developer', 'vue developer', 'web designer'])
on conflict (role_key) do nothing;

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version) values
  ('frontend-developer', 'html-semantics', 'Semantic HTML', 'frontend.html_semantics', 'frontend_workspace', true, 1, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('frontend-developer', 'css-layout', 'CSS layout', 'frontend.css_layout', 'frontend_workspace', true, 2, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('frontend-developer', 'responsive-design', 'Responsive design', 'frontend.responsive_design', 'frontend_workspace', true, 3, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('frontend-developer', 'accessibility', 'Accessibility', 'frontend.accessibility', 'frontend_workspace', true, 4, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('frontend-developer', 'forms', 'Forms', 'frontend.forms', 'frontend_workspace', true, 5, 'frontend.gen.v1', 'frontend.grade.v1'),
  ('frontend-developer', 'frontend-debugging', 'Debugging pages', 'frontend.frontend_debugging', 'frontend_workspace', true, 6, 'frontend.gen.v1', 'frontend.grade.v1')
on conflict (role_key, area_key) do nothing;
