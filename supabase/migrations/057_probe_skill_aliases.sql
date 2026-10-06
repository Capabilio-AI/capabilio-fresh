-- Map the free-text skill names the Career Interests assessment produced onto canonical skills, so a student's
-- assessed ability counts toward roadmap readiness. Aliases are normalized (lowercase, punctuation -> space).
insert into skill_aliases (alias, skill_id)
select v.alias, s.id
from (values
  ('algorithm analysis','Algorithms'), ('algorithmic analysis','Algorithms'), ('algorithmic efficiency analysis','Algorithms'),
  ('data structures knowledge','Data Structures'), ('knowledge of data structures','Data Structures'),
  ('debugging problem solving','Problem Solving'), ('problem solving approach','Problem Solving'), ('analytical problem solving skills','Problem Solving'),
  ('object oriented design','Object-Oriented Programming'), ('conceptual understanding of oop','Object-Oriented Programming'),
  ('version control proficiency','Version Control'),
  ('testing methodology','Software Testing'), ('software testing fundamentals','Software Testing'),
  ('design patterns','Software Engineering'), ('knowledge of design patterns','Software Engineering'), ('understanding of design patterns','Software Engineering'), ('commitment to code quality','Software Engineering'),
  ('database concurrency','Database Management Systems'),
  ('web protocols knowledge','Computer Networks'),
  ('concurrency primitives','Operating Systems'), ('concurrency understanding','Operating Systems'), ('memory management','Operating Systems'),
  ('api design','API Design'), ('api design knowledge','API Design'), ('api design understanding','API Design'),
  ('devops ci cd tooling','CI/CD'),
  ('collaboration and communication','Teamwork'), ('teamwork communication','Teamwork'), ('collaboration and communication skills','Teamwork'),
  ('communication requirement gathering','Technical Communication'), ('communication requirement clarification','Technical Communication')
) as v(alias, skill_name)
join skills s on s.name = v.skill_name and s.status = 'active'
on conflict do nothing;
