-- Canonical skill taxonomy (Phase 1 of the curriculum -> roadmap work; docs/curriculum-roadmap-audit.md §5, Q1).
--
-- ADDITIVE. The existing `skills` table (146 free-text rows, nothing in app code reads it) is extended in place.
-- Every existing row becomes status='candidate': unreviewed, never resolved by resolveSkill(), never mapped to.
-- Only the starter set below (marked active) is canonical. PRODUCT-TEAM REVIEW: the starter set is editable data, not student data.

alter table public.skills
  add column key text,
  add column category text,
  add column parent_skill_id uuid references public.skills(id) on delete set null,
  add column description text,
  add column level_definition jsonb,
  add column status text not null default 'candidate' check (status in ('active', 'candidate', 'deprecated')),
  add column updated_at timestamptz not null default now();
create unique index skills_key_unique on public.skills (key) where key is not null;
alter table public.skills add constraint skills_active_has_key check (status <> 'active' or (key is not null and category is not null));
create index skills_parent on public.skills (parent_skill_id);

-- alias text is stored already normalized (lowercase, punctuation dropped except + and #) so lookups are exact.
create table public.skill_aliases (
  alias text primary key check (alias = lower(btrim(alias)) and char_length(alias) between 1 and 200),
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index skill_aliases_skill on public.skill_aliases (skill_id);

-- Text the resolver could not place. Never auto-created into skills; a Capabilio admin reviews these.
create table public.skill_suggestions (
  normalized_text text primary key check (char_length(normalized_text) between 1 and 200),
  display_text text not null,
  source text not null check (source in ('course_extraction', 'course_mapping', 'career_requirement', 'capability', 'other')),
  occurrences integer not null default 1 check (occurrences >= 1),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_skill_id uuid references public.skills(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Arena skill areas keep their own keys; this links each to its canonical skill.
alter table public.arena_skill_areas add column skill_id uuid references public.skills(id);

-- Authority: skills and aliases are world-readable (a taxonomy) but written only by the service role.
-- Suggestions are private to the service role.
alter table public.skill_aliases enable row level security;
alter table public.skill_suggestions enable row level security;
create policy skill_aliases_read_all on public.skill_aliases for select using (true);
revoke insert, update, delete, truncate on public.skills, public.skill_aliases from anon, authenticated;
revoke all on public.skill_suggestions from anon, authenticated;

-- Starter taxonomy. On a name collision with an old candidate row, that row is promoted in place.
with seed(key, name, category, parent_key, description) as (values
  ('SKILL_PROGRAMMING_FUNDAMENTALS', 'Programming Fundamentals', 'Programming', null, 'Variables, control flow, functions and basic problem decomposition in code.'),
  ('SKILL_PYTHON', 'Python', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Writing and reading Python programs.'),
  ('SKILL_JAVA', 'Java', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Writing and reading Java programs.'),
  ('SKILL_C', 'C Programming', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Writing and reading C programs, including pointers and memory.'),
  ('SKILL_CPP', 'C++ Programming', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Writing and reading C++ programs.'),
  ('SKILL_JAVASCRIPT', 'JavaScript', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Writing and reading JavaScript and TypeScript.'),
  ('SKILL_OOP', 'Object-Oriented Programming', 'Programming', 'SKILL_PROGRAMMING_FUNDAMENTALS', 'Classes, inheritance, polymorphism and encapsulation.'),
  ('SKILL_DATA_STRUCTURES', 'Data Structures', 'Programming', null, 'Arrays, lists, stacks, queues, trees, graphs, hash tables and their trade-offs.'),
  ('SKILL_ALGORITHMS', 'Algorithms', 'Programming', null, 'Designing and implementing algorithms; sorting, searching, divide and conquer, greedy, dynamic programming.'),
  ('SKILL_ALGORITHM_ANALYSIS', 'Algorithm Analysis', 'Programming', 'SKILL_ALGORITHMS', 'Time and space complexity, asymptotic notation, recurrences.'),
  ('SKILL_GRAPH_ALGORITHMS', 'Graph Algorithms', 'Programming', 'SKILL_ALGORITHMS', 'Graph traversal, shortest paths, spanning trees, flows.'),
  ('SKILL_PROBLEM_SOLVING', 'Problem Solving', 'Problem Solving', null, 'Breaking an unfamiliar problem into steps and reaching a correct solution.'),
  ('SKILL_SQL', 'SQL', 'Data', null, 'Querying and shaping relational data with SQL.'),
  ('SKILL_SPREADSHEETS', 'Excel / Spreadsheets', 'Data', null, 'Analysis, formulas and pivots in spreadsheet tools.'),
  ('SKILL_BI_DASHBOARDING', 'BI / Dashboarding', 'Data', null, 'Building dashboards and reports with BI tools.'),
  ('SKILL_STATISTICS', 'Statistics', 'Data', null, 'Descriptive and inferential statistics, hypothesis testing.'),
  ('SKILL_DATA_CLEANING', 'Data Cleaning', 'Data', null, 'Finding and fixing quality problems in raw data.'),
  ('SKILL_DATA_ANALYSIS', 'Data Analysis', 'Data', null, 'Turning data into findings that answer a question.'),
  ('SKILL_DATA_MINING', 'Data Mining', 'Data', 'SKILL_DATA_ANALYSIS', 'Pattern discovery in large datasets: association, clustering, classification.'),
  ('SKILL_DATA_WAREHOUSING', 'Data Warehousing', 'Data', null, 'Dimensional modelling, ETL and analytical data stores.'),
  ('SKILL_PROBABILITY', 'Probability', 'Mathematics', null, 'Probability theory and random variables.'),
  ('SKILL_DISCRETE_MATH', 'Discrete Mathematics', 'Mathematics', null, 'Logic, sets, relations, combinatorics and graph theory.'),
  ('SKILL_LINEAR_ALGEBRA', 'Linear Algebra', 'Mathematics', null, 'Vectors, matrices and linear transformations.'),
  ('SKILL_DBMS', 'Database Management Systems', 'Databases', null, 'How database systems store, index, query and protect data.'),
  ('SKILL_DATABASE_DESIGN', 'Relational Database Design', 'Databases', 'SKILL_DBMS', 'ER modelling, normalisation and schema design.'),
  ('SKILL_NOSQL', 'NoSQL Databases', 'Databases', 'SKILL_DBMS', 'Document, key-value, column and graph stores.'),
  ('SKILL_MACHINE_LEARNING', 'Machine Learning', 'AI/ML', null, 'Training and evaluating supervised and unsupervised models.'),
  ('SKILL_DEEP_LEARNING', 'Deep Learning', 'AI/ML', 'SKILL_MACHINE_LEARNING', 'Neural networks and their training.'),
  ('SKILL_NLP', 'Natural Language Processing', 'AI/ML', null, 'Working with and modelling text.'),
  ('SKILL_AI_FUNDAMENTALS', 'Artificial Intelligence Fundamentals', 'AI/ML', null, 'Search, knowledge representation and reasoning.'),
  ('SKILL_CLOUD_COMPUTING', 'Cloud Computing', 'Cloud', null, 'Cloud service models, deployment and core services.'),
  ('SKILL_CRYPTOGRAPHY', 'Cryptography', 'Cybersecurity', null, 'Symmetric and public-key cryptography and its applications.'),
  ('SKILL_NETWORK_SECURITY', 'Network Security', 'Cybersecurity', null, 'Securing networks and communications.'),
  ('SKILL_INFORMATION_SECURITY', 'Information Security Fundamentals', 'Cybersecurity', null, 'Threats, controls and security principles.'),
  ('SKILL_SOFTWARE_ENGINEERING', 'Software Engineering', 'Software Engineering', null, 'Process, requirements, design and maintenance of software.'),
  ('SKILL_SOFTWARE_TESTING', 'Software Testing', 'Software Engineering', 'SKILL_SOFTWARE_ENGINEERING', 'Designing and automating tests.'),
  ('SKILL_VERSION_CONTROL', 'Version Control', 'Software Engineering', null, 'Working with Git and collaborative code workflows.'),
  ('SKILL_WEB_DEVELOPMENT', 'Web Development', 'Software Engineering', null, 'Building web front ends and back ends.'),
  ('SKILL_API_DESIGN', 'API Design', 'Software Engineering', null, 'Designing and consuming web APIs.'),
  ('SKILL_SYSTEM_DESIGN', 'System Design', 'Software Engineering', null, 'Designing scalable multi-component systems.'),
  ('SKILL_OPERATING_SYSTEMS', 'Operating Systems', 'Computer Systems', null, 'Processes, memory, file systems and concurrency.'),
  ('SKILL_COMPUTER_NETWORKS', 'Computer Networks', 'Computer Systems', null, 'Network layers, protocols and routing.'),
  ('SKILL_COMPUTER_ARCHITECTURE', 'Computer Architecture', 'Computer Systems', null, 'Processor, memory hierarchy and instruction sets.'),
  ('SKILL_COMPILER_DESIGN', 'Compiler Design', 'Computer Systems', null, 'Lexing, parsing and code generation.'),
  ('SKILL_LINUX', 'Linux', 'DevOps', null, 'Working at the Linux command line.'),
  ('SKILL_CICD', 'CI/CD', 'DevOps', null, 'Automated build, test and delivery pipelines.'),
  ('SKILL_CONTAINERIZATION', 'Containerization', 'DevOps', null, 'Packaging and running software in containers.'),
  ('SKILL_UI_UX_DESIGN', 'UI/UX Design', 'Design', null, 'Designing usable interfaces and user flows.'),
  ('SKILL_TECHNICAL_COMMUNICATION', 'Technical Communication', 'Communication', null, 'Explaining technical work in writing and speech.'),
  ('SKILL_TEAMWORK', 'Teamwork', 'Communication', null, 'Working effectively in a team on shared work.'),
  ('SKILL_BUSINESS_ANALYSIS', 'Business Analysis', 'Business', null, 'Understanding business needs and turning them into requirements.'),
  ('SKILL_PROJECT_MANAGEMENT', 'Project Management', 'Business', null, 'Planning and delivering projects.'),
  ('SKILL_PRODUCT_MANAGEMENT', 'Product Management', 'Business', null, 'Deciding what to build and why.')
)
insert into public.skills (key, name, category, description, status)
select key, name, category, description, 'active' from seed
on conflict (name) do update
  set key = excluded.key, category = excluded.category, description = excluded.description, status = 'active', updated_at = now();

update public.skills s set parent_skill_id = p.id
from (values
  ('SKILL_PYTHON','SKILL_PROGRAMMING_FUNDAMENTALS'),('SKILL_JAVA','SKILL_PROGRAMMING_FUNDAMENTALS'),('SKILL_C','SKILL_PROGRAMMING_FUNDAMENTALS'),
  ('SKILL_CPP','SKILL_PROGRAMMING_FUNDAMENTALS'),('SKILL_JAVASCRIPT','SKILL_PROGRAMMING_FUNDAMENTALS'),('SKILL_OOP','SKILL_PROGRAMMING_FUNDAMENTALS'),
  ('SKILL_ALGORITHM_ANALYSIS','SKILL_ALGORITHMS'),('SKILL_GRAPH_ALGORITHMS','SKILL_ALGORITHMS'),('SKILL_DATA_MINING','SKILL_DATA_ANALYSIS'),
  ('SKILL_DATABASE_DESIGN','SKILL_DBMS'),('SKILL_NOSQL','SKILL_DBMS'),('SKILL_DEEP_LEARNING','SKILL_MACHINE_LEARNING'),
  ('SKILL_SOFTWARE_TESTING','SKILL_SOFTWARE_ENGINEERING')
) m(child_key, parent_key)
join public.skills p on p.key = m.parent_key
where s.key = m.child_key;

insert into public.skill_aliases (alias, skill_id)
select a.alias, s.id from (values
  ('SKILL_PYTHON','python programming'),('SKILL_PYTHON','python language'),('SKILL_PYTHON','python3'),('SKILL_PYTHON','python 3'),
  ('SKILL_JAVA','java programming'),('SKILL_JAVA','core java'),
  ('SKILL_C','c'),('SKILL_C','c language'),('SKILL_C','c programming language'),
  ('SKILL_CPP','c++'),('SKILL_CPP','cpp'),('SKILL_CPP','c plus plus'),
  ('SKILL_JAVASCRIPT','javascript'),('SKILL_JAVASCRIPT','js'),('SKILL_JAVASCRIPT','typescript'),('SKILL_JAVASCRIPT','ecmascript'),
  ('SKILL_OOP','oop'),('SKILL_OOP','object oriented programming'),('SKILL_OOP','object oriented design'),
  ('SKILL_DATA_STRUCTURES','data structure'),('SKILL_DATA_STRUCTURES','dsa'),('SKILL_DATA_STRUCTURES','advanced data structures'),
  ('SKILL_ALGORITHMS','algorithm'),('SKILL_ALGORITHMS','algorithm design'),('SKILL_ALGORITHMS','design and analysis of algorithms'),
  ('SKILL_ALGORITHM_ANALYSIS','time complexity'),('SKILL_ALGORITHM_ANALYSIS','complexity analysis'),('SKILL_ALGORITHM_ANALYSIS','asymptotic analysis'),
  ('SKILL_GRAPH_ALGORITHMS','graph theory algorithms'),('SKILL_GRAPH_ALGORITHMS','bfs dfs'),('SKILL_GRAPH_ALGORITHMS','graph traversal'),
  ('SKILL_PROBLEM_SOLVING','problem solving skills'),('SKILL_PROBLEM_SOLVING','analytical problem solving'),
  ('SKILL_SQL','structured query language'),('SKILL_SQL','sql queries'),('SKILL_SQL','mysql'),('SKILL_SQL','postgresql'),
  ('SKILL_SPREADSHEETS','excel'),('SKILL_SPREADSHEETS','spreadsheet'),('SKILL_SPREADSHEETS','spreadsheets'),('SKILL_SPREADSHEETS','microsoft excel'),('SKILL_SPREADSHEETS','google sheets'),
  ('SKILL_BI_DASHBOARDING','bi'),('SKILL_BI_DASHBOARDING','dashboarding'),('SKILL_BI_DASHBOARDING','dashboards'),('SKILL_BI_DASHBOARDING','data visualization'),
  ('SKILL_BI_DASHBOARDING','data visualisation'),('SKILL_BI_DASHBOARDING','power bi'),('SKILL_BI_DASHBOARDING','tableau'),('SKILL_BI_DASHBOARDING','business intelligence'),
  ('SKILL_STATISTICS','statistical analysis'),('SKILL_STATISTICS','statistical methods'),('SKILL_STATISTICS','inferential statistics'),
  ('SKILL_DATA_CLEANING','data cleansing'),('SKILL_DATA_CLEANING','data preprocessing'),('SKILL_DATA_CLEANING','data wrangling'),('SKILL_DATA_CLEANING','data preparation'),
  ('SKILL_DATA_ANALYSIS','data analytics'),('SKILL_DATA_ANALYSIS','analytics'),
  ('SKILL_DATA_MINING','data mining techniques'),
  ('SKILL_DATA_WAREHOUSING','data warehouse'),('SKILL_DATA_WAREHOUSING','etl'),('SKILL_DATA_WAREHOUSING','olap'),
  ('SKILL_PROBABILITY','probability theory'),('SKILL_PROBABILITY','probability and statistics'),
  ('SKILL_DISCRETE_MATH','discrete mathematics'),('SKILL_DISCRETE_MATH','discrete structures'),
  ('SKILL_LINEAR_ALGEBRA','matrices'),('SKILL_LINEAR_ALGEBRA','matrix algebra'),
  ('SKILL_DBMS','dbms'),('SKILL_DBMS','database management'),('SKILL_DBMS','database systems'),('SKILL_DBMS','databases'),
  ('SKILL_DATABASE_DESIGN','database design'),('SKILL_DATABASE_DESIGN','er modeling'),('SKILL_DATABASE_DESIGN','normalization'),('SKILL_DATABASE_DESIGN','normalisation'),
  ('SKILL_NOSQL','nosql'),('SKILL_NOSQL','mongodb'),
  ('SKILL_MACHINE_LEARNING','ml'),('SKILL_MACHINE_LEARNING','machine learning algorithms'),
  ('SKILL_DEEP_LEARNING','neural networks'),('SKILL_DEEP_LEARNING','dl'),
  ('SKILL_NLP','nlp'),('SKILL_NLP','text mining'),
  ('SKILL_AI_FUNDAMENTALS','artificial intelligence'),('SKILL_AI_FUNDAMENTALS','ai'),('SKILL_AI_FUNDAMENTALS','ai fundamentals'),
  ('SKILL_CLOUD_COMPUTING','cloud'),('SKILL_CLOUD_COMPUTING','cloud computing fundamentals'),
  ('SKILL_CRYPTOGRAPHY','cryptography and network security'),('SKILL_CRYPTOGRAPHY','encryption'),
  ('SKILL_NETWORK_SECURITY','network security fundamentals'),
  ('SKILL_INFORMATION_SECURITY','cyber security'),('SKILL_INFORMATION_SECURITY','cybersecurity'),('SKILL_INFORMATION_SECURITY','information security'),
  ('SKILL_SOFTWARE_ENGINEERING','se'),('SKILL_SOFTWARE_ENGINEERING','software development life cycle'),('SKILL_SOFTWARE_ENGINEERING','sdlc'),
  ('SKILL_SOFTWARE_TESTING','testing'),('SKILL_SOFTWARE_TESTING','unit testing'),('SKILL_SOFTWARE_TESTING','test automation'),
  ('SKILL_VERSION_CONTROL','git'),('SKILL_VERSION_CONTROL','github'),
  ('SKILL_WEB_DEVELOPMENT','web development'),('SKILL_WEB_DEVELOPMENT','web technologies'),('SKILL_WEB_DEVELOPMENT','html css'),('SKILL_WEB_DEVELOPMENT','full stack development'),
  ('SKILL_API_DESIGN','api design knowledge'),('SKILL_API_DESIGN','api design understanding'),('SKILL_API_DESIGN','rest api'),('SKILL_API_DESIGN','rest apis'),
  ('SKILL_SYSTEM_DESIGN','systems design'),('SKILL_SYSTEM_DESIGN','software architecture'),
  ('SKILL_OPERATING_SYSTEMS','os'),('SKILL_OPERATING_SYSTEMS','operating system'),
  ('SKILL_COMPUTER_NETWORKS','networking'),('SKILL_COMPUTER_NETWORKS','computer networking'),('SKILL_COMPUTER_NETWORKS','data communication'),
  ('SKILL_COMPUTER_ARCHITECTURE','computer organization'),('SKILL_COMPUTER_ARCHITECTURE','computer organization and architecture'),
  ('SKILL_COMPILER_DESIGN','compilers'),
  ('SKILL_LINUX','unix'),('SKILL_LINUX','shell scripting'),
  ('SKILL_CICD','ci cd'),('SKILL_CICD','continuous integration'),('SKILL_CICD','devops'),
  ('SKILL_CONTAINERIZATION','docker'),('SKILL_CONTAINERIZATION','kubernetes'),('SKILL_CONTAINERIZATION','containers'),
  ('SKILL_UI_UX_DESIGN','ui design'),('SKILL_UI_UX_DESIGN','ux design'),('SKILL_UI_UX_DESIGN','user experience design'),('SKILL_UI_UX_DESIGN','ui ux'),
  ('SKILL_TECHNICAL_COMMUNICATION','communication'),('SKILL_TECHNICAL_COMMUNICATION','communication skills'),('SKILL_TECHNICAL_COMMUNICATION','technical writing'),('SKILL_TECHNICAL_COMMUNICATION','presentation skills'),
  ('SKILL_TEAMWORK','team work'),('SKILL_TEAMWORK','collaboration'),
  ('SKILL_BUSINESS_ANALYSIS','business analytics'),('SKILL_BUSINESS_ANALYSIS','requirements gathering'),
  ('SKILL_PROJECT_MANAGEMENT','project planning'),
  ('SKILL_PRODUCT_MANAGEMENT','product strategy')
) a(skill_key, alias)
join public.skills s on s.key = a.skill_key
on conflict (alias) do nothing;

-- Link Arena's skill areas to canonical skills.
update public.arena_skill_areas a set skill_id = s.id
from (values
  ('sql','SKILL_SQL'),('spreadsheet','SKILL_SPREADSHEETS'),('dashboard','SKILL_BI_DASHBOARDING'),
  ('statistics','SKILL_STATISTICS'),('data_cleaning','SKILL_DATA_CLEANING'),('python','SKILL_PYTHON')
) m(area_key, skill_key)
join public.skills s on s.key = m.skill_key
where a.role_key = 'data-analyst' and a.area_key = m.area_key;
