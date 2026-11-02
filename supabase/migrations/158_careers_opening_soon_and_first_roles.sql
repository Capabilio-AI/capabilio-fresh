-- A role can be announced before it takes applications ("soon"), and the first five roles are saved. Safe to run twice: roles are keyed by slug and left alone if they exist.
alter table public.job_openings drop constraint if exists job_openings_status_check;
alter table public.job_openings add constraint job_openings_status_check check (status in ('draft', 'open', 'soon', 'closed'));

-- All five roles are hybrid and based in Vijayawada.
-- Full-time roles are "soon" (listed, not taking applications). Internships are open and unpaid.
insert into public.job_openings (slug, title, team, location, work_mode, employment_type, summary, about, responsibilities, requirements, nice_to_have, proof_brief, compensation, status, published_at) values
(
  'campus-partnerships-lead',
  'Campus Partnerships Lead',
  'Partnerships',
  'Vijayawada',
  'hybrid',
  'full_time',
  $t$Bring colleges and universities onto Capabilio and make sure each cohort starts, grows and renews.$t$,
  $t$Colleges and universities are one of the main ways Capabilio reaches students at scale. You will own that relationship from the first conversation to the first renewal.

You will work directly with the founder. You will talk to placement officers, principals and department heads, run pilots with a first cohort, and bring back what colleges actually need so the product follows it.$t$,
  array[
    $t$Open conversations with colleges and universities and run pilots with a first cohort$t$,
    $t$Understand how each college decides and buys, and guide it through that process$t$,
    $t$Get every cohort started: students enrolled, the academic calendar set, faculty using it$t$,
    $t$Bring back what colleges ask for and turn it into clear requests for the product team$t$,
    $t$Keep each college active and lead the renewal conversation$t$
  ],
  array[
    $t$You have sold, partnered or run programs with colleges, universities or education institutions$t$,
    $t$You can explain a technical product plainly to a non-technical decision maker$t$,
    $t$You follow through: a pilot that starts also finishes$t$,
    $t$Clear speaking and writing in English$t$
  ],
  array[
    $t$Existing relationships with colleges or universities$t$,
    $t$Experience with edtech or placement programs$t$
  ],
  $t$Pick one real college you know. Write one page: who at that college decides, what they would want to see from Capabilio in a first 30-day pilot, and how you would know it worked. Tell us what you would need from us to make it happen.$t$,
  null,
  'soon',
  null
),
(
  'founding-full-stack-engineer',
  'Founding Full-Stack Engineer',
  'Engineering',
  'Vijayawada',
  'hybrid',
  'full_time',
  $t$Own the product end to end: the web app, the scoring and rating engine, and the foundations for mobile apps.$t$,
  $t$Capabilio turns what a person has actually demonstrated into a record they and their college can trust. You will build and run the system that does that.

You will work directly with the founder and own large parts of the product from design to production: the web app, the database and the APIs behind it. You will also help lay the foundations for Android and iOS apps.$t$,
  array[
    $t$Ship features across the web app, APIs and database, from idea to production$t$,
    $t$Keep scoring, ratings and every number in the product traceable to real evidence$t$,
    $t$Protect student data: authorization checks, input validation and safe handling of secrets$t$,
    $t$Write tests and keep releases safe and uneventful$t$,
    $t$Prepare the codebase for mobile apps: token-based sign-in, shared logic and push notifications$t$
  ],
  array[
    $t$Strong TypeScript and React, with Next.js experience$t$,
    $t$Solid Postgres and SQL, and you have worked with row-level security or similar access rules$t$,
    $t$You have shipped and run something real in production$t$,
    $t$You write code others can maintain, and you care about security$t$
  ],
  array[
    $t$Supabase experience$t$,
    $t$React Native or Expo$t$,
    $t$Experience with AI model APIs and measuring their output$t$
  ],
  $t$Imagine a messy list of quiz attempts: some repeated, some with missing answers, some timed out. Write the smallest scorer you would trust to turn it into a rating, with tests. Tell us what it cannot tell you.$t$,
  null,
  'soon',
  null
),
(
  'assessment-content-intern',
  'Assessment and Content Intern',
  'Content',
  'Vijayawada',
  'hybrid',
  'internship',
  $t$Write and check the challenges and questions that students are measured on.$t$,
  $t$What Capabilio measures is only as good as the questions behind it. You will help write, test and review Arena challenges and question banks for a career stream you know well.

You will work with the founder and learn how real assessment is designed: what a question actually tests, how it can be gamed, and how to make it fair.$t$,
  array[
    $t$Write practical challenges and questions for one career stream$t$,
    $t$Solve each one yourself first, and note where it is unclear or too easy$t$,
    $t$Review and fix existing questions that are wrong, outdated or ambiguous$t$,
    $t$Keep answers and explanations accurate$t$
  ],
  array[
    $t$You are a student or recent graduate with solid knowledge of one stream, such as data analysis, software, design or business$t$,
    $t$You write carefully and accurately$t$,
    $t$You enjoy finding mistakes$t$
  ],
  array[
    $t$Experience tutoring or mentoring others$t$,
    $t$A project or portfolio in your stream$t$
  ],
  $t$Write three questions for a topic you know well. For each, give the answer, explain why a wrong answer is tempting, and say how someone could get it right without understanding the topic. Fix the question if they could.$t$,
  'Unpaid internship',
  'open',
  now()
),
(
  'campus-growth-intern',
  'Campus Growth Intern',
  'Growth',
  'Vijayawada',
  'hybrid',
  'internship',
  $t$Help students and colleges discover Capabilio through your own campus and network.$t$,
  $t$Capabilio grows when students try it and tell other students. You will help bring it to students and their colleges, learn what makes people sign up and keep coming back, and report what works.

You will work with the founder and the partnerships team and learn how a product earns its first users.$t$,
  array[
    $t$Introduce Capabilio to students on your campus and in your network$t$,
    $t$Run small, honest outreach experiments and write down what worked and what did not$t$,
    $t$Collect student feedback and share it with the product team$t$,
    $t$Support introductions and follow-ups with colleges$t$
  ],
  array[
    $t$You are a current student or recent graduate$t$,
    $t$You are comfortable talking to people and writing clearly$t$,
    $t$You are reliable: you do what you said you would$t$
  ],
  array[
    $t$You have led or organised a club, community or event$t$,
    $t$Content or social media skills$t$
  ],
  $t$Pick one group of students you can reach, such as a club, a class or a community. Tell us how you would introduce Capabilio to them, what you would measure after two weeks, and what you would do if nobody signed up.$t$,
  'Unpaid internship',
  'open',
  now()
),
(
  'engineering-intern',
  'Engineering Intern',
  'Engineering',
  'Vijayawada',
  'hybrid',
  'internship',
  $t$Write tests, fix bugs and ship small features on a real production codebase.$t$,
  $t$You will work on the real Capabilio codebase with the founder, learn how a production TypeScript app is built and kept safe, and ship real changes.$t$,
  array[
    $t$Fix bugs and ship small, well-tested features$t$,
    $t$Add tests for behaviour that is not covered yet$t$,
    $t$Improve error messages, accessibility and loading states$t$,
    $t$Read code and ask questions until you understand it$t$
  ],
  array[
    $t$You can write TypeScript or JavaScript and have built at least one project$t$,
    $t$You know basic Git and SQL$t$,
    $t$You can explain what you built and what you would change$t$
  ],
  array[
    $t$React or Next.js$t$,
    $t$Open-source contributions$t$
  ],
  $t$Show us a project you built. In a short note, tell us one bug you found late, how you found it, and the test you would write to catch it.$t$,
  'Unpaid internship',
  'open',
  now()
)
on conflict (slug) do nothing;

-- For a database where an earlier version of this file already ran: the three internships are hybrid.
update public.job_openings set work_mode = 'hybrid' where slug in ('assessment-content-intern', 'campus-growth-intern', 'engineering-intern');
