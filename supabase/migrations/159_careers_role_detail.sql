-- Longer, more useful role pages: what the work looks like, the first months, and this role's interview steps.
-- Also sets all five roles to hybrid in Vijayawada and writes their full text. Safe to run twice; it overwrites those five roles' text, so run it before editing them in /admin/careers.
alter table public.job_openings add column if not exists day_to_day text check (day_to_day is null or length(day_to_day) <= 3000);
alter table public.job_openings add column if not exists first_months text[] not null default '{}' check (cardinality(first_months) <= 8);
alter table public.job_openings add column if not exists interview jsonb not null default '[]'::jsonb check (jsonb_typeof(interview) = 'array' and jsonb_array_length(interview) <= 8);

update public.job_openings set work_mode = 'hybrid', location = 'Vijayawada' where slug in ('campus-partnerships-lead', 'founding-full-stack-engineer', 'assessment-content-intern', 'campus-growth-intern', 'engineering-intern');

-- Campus Partnerships Lead
update public.job_openings set
  about = $t$Colleges and universities are one of the main ways Capabilio reaches students at scale. A college that adopts Capabilio gives its students a career map, assessments and a rating built from real work, and gives its faculty and placement team one honest view of how ready their students are.

This role owns that relationship from the first conversation to the renewal. You are not a salesperson handing over a brochure. You are the person a placement officer or head of department calls when a cohort needs to start, when something breaks, or when they want to know whether it is working.

You will work directly with the founder. Early on there is no playbook to follow, so you will write it: which colleges to approach, what a good pilot looks like, what to promise and what not to, and how to tell whether a college is really using the product.$t$,
  day_to_day = $t$Most weeks mix four kinds of work.

Conversations: first meetings and follow-ups with placement officers, principals and heads of department, in person and online.

Pilots: planning a first cohort with a college, getting students enrolled, setting the academic calendar and walking faculty through what they see in the product.

Listening: collecting what each college asked for, what confused its students and what its faculty liked, and writing it up clearly for the product team.

Keeping score: tracking which colleges have started, which are active and which are going quiet, and acting before they drift away. Some of this is in person at colleges, which is why the role is hybrid.$t$,
  responsibilities = array[
    $t$Open conversations with colleges and universities and run pilots with a first cohort$t$,
    $t$Understand how each college decides and buys, and guide it through that process$t$,
    $t$Get every cohort started: students enrolled, the academic calendar set, faculty using it$t$,
    $t$Walk faculty and placement teams through what they see in the product$t$,
    $t$Bring back what colleges ask for and turn it into clear requests for the product team$t$,
    $t$Track which colleges are active and step in early when one goes quiet$t$,
    $t$Keep each college active and lead the renewal conversation$t$,
    $t$Write down what works so the next partnership starts faster$t$
  ],
  requirements = array[
    $t$You have sold, partnered or run programs with colleges, universities or education institutions$t$,
    $t$You can explain a technical product plainly to a non-technical decision maker$t$,
    $t$You are comfortable in a room with a principal or a head of department$t$,
    $t$You follow through: a pilot that starts also finishes$t$,
    $t$You write clear follow-ups and short reports$t$,
    $t$Clear speaking and writing in English$t$,
    $t$You are comfortable on a small team where the plan is still being written$t$
  ],
  nice_to_have = array[
    $t$Existing relationships with colleges or universities$t$,
    $t$Experience with edtech or placement programs$t$,
    $t$Fluency in a regional language used by the colleges you would work with$t$,
    $t$Experience tracking partnerships in a CRM or a simple spreadsheet$t$
  ],
  first_months = array[
    $t$Month one: learn the product as a student and as a college administrator$t$,
    $t$Month one: write the first version of the pilot plan: who we approach, what we offer and what we ask in return$t$,
    $t$Month two: run your first conversations and bring back what you hear$t$,
    $t$Month three: start your first pilot cohort with a college and track it week by week$t$,
    $t$Ongoing: turn what worked and what did not into a repeatable way to start a college$t$
  ],
  interview = $j$[
    {"title": "Send proof", "body": "Tell us about one program, pilot or partnership you ran or helped run, and what actually happened. Use the form or email careers@capabilio.online."},
    {"title": "We read it", "body": "The founder reads it and looks at what you did yourself, not only the outcome."},
    {"title": "Write the one-page plan", "body": "You write the college plan described under Your first proof. It is scoped before you start, so you know what we are looking for."},
    {"title": "Talk it through", "body": "We go through your plan together and talk about how a first call with a placement officer would go. Either way, you hear the answer from us."}
  ]$j$::jsonb
where slug = 'campus-partnerships-lead';

-- Founding Full-Stack Engineer
update public.job_openings set
  about = $t$Capabilio turns what a person has actually demonstrated into a record they and their college can trust. That record is only worth something if every number in it can be traced back to real evidence, and if student data is handled with care. You will build and protect the system that does that.

You will work directly with the founder and own large parts of the product from design to production: the web app, the database and the APIs behind it. The stack is TypeScript, React and Next.js on Postgres with Supabase. AI models are used to generate and explain, never to invent facts.

You will also help lay the foundations for Android and iOS apps, so the choices you make now, such as how sign-in works and how logic is shared, decide how cheap mobile is later.$t$,
  day_to_day = $t$A normal stretch might mean taking a feature from a rough idea to production: sketching the data model, writing the migration, building the API and the screen, adding tests, and watching it after release.

Other days are about keeping things true and safe: checking that a rating can be explained from its evidence, closing an authorization gap, or tracing why a student's number did not move.

You will read a lot of existing code, and you are expected to leave it clearer than you found it. Releases are small and frequent, and nothing ships without a test that would fail if it broke.$t$,
  responsibilities = array[
    $t$Ship features across the web app, APIs and database, from idea to production$t$,
    $t$Keep scoring, ratings and every number in the product traceable to real evidence$t$,
    $t$Protect student data: authorization checks, input validation and safe handling of secrets$t$,
    $t$Write tests and keep releases safe and uneventful$t$,
    $t$Prepare the codebase for mobile apps: token-based sign-in, shared logic and push notifications$t$,
    $t$Watch production for errors, slow routes and AI failures, and fix what you find$t$,
    $t$Review changes, your own and later other people's, with security in mind$t$,
    $t$Write down decisions that other engineers will need later$t$
  ],
  requirements = array[
    $t$Strong TypeScript and React, with Next.js experience$t$,
    $t$Solid Postgres and SQL, and you have worked with row-level security or similar access rules$t$,
    $t$You have shipped and run something real in production$t$,
    $t$You write code others can maintain$t$,
    $t$You build security in: validate input and check authorization on every route$t$,
    $t$You ship in small steps and can estimate honestly$t$,
    $t$You are comfortable owning a problem without a detailed spec$t$
  ],
  nice_to_have = array[
    $t$Supabase experience$t$,
    $t$React Native or Expo$t$,
    $t$Experience with AI model APIs and measuring their output$t$,
    $t$Testing with Vitest or a similar tool$t$,
    $t$Experience with education or assessment products$t$
  ],
  first_months = array[
    $t$Week one: set up, read the codebase and ship a small fix to production$t$,
    $t$Month one: take one real feature end to end, with tests$t$,
    $t$Month two: review how authorization and secrets are handled across the APIs and fix the highest risks you find$t$,
    $t$Month three: lead the first step towards mobile, such as token-based sign-in$t$,
    $t$Ongoing: keep releases small, safe and uneventful$t$
  ],
  interview = $j$[
    {"title": "Send proof", "body": "A link to something you built and ran: a repository, a live app or a write-up. Tell us what you would change about it."},
    {"title": "We read it", "body": "We read the code, the history and your note, and ask what you would do differently."},
    {"title": "Write the small scorer", "body": "The brief under Your first proof: a scorer for messy quiz attempts, with tests. It is written down before you start."},
    {"title": "Talk it through", "body": "We walk through your scorer together, then through a real part of our system and how you would change it. Either way, you hear the answer from us."}
  ]$j$::jsonb
where slug = 'founding-full-stack-engineer';

-- Assessment and Content Intern
update public.job_openings set
  about = $t$What Capabilio measures is only as good as the questions behind it. A question that can be guessed, or that is simply wrong, gives a student a number that means nothing. That is why content is the heart of the product, and why we want interns who care about getting it right.

You will help write, test and review Arena challenges and question banks for a career stream you know well, such as data analysis, software, design or business. You will learn how real assessment is designed: what a question actually tests, how it can be gamed, and how to make it fair.

You will work with the founder and get direct feedback on your work. It is an unpaid internship, so we keep the scope clear and the learning real.$t$,
  day_to_day = $t$A typical week is a loop. Pick a topic in your stream, write a few practical questions or a short challenge, then solve each one yourself without looking at the answer. Then try to break them: could someone get this right by guessing, by spotting a pattern, or by memorising? Fix the question until the answer is no.

Some time goes to reviewing existing questions that are wrong, outdated or unclear, and to writing short explanations that tell a student why an answer is right or wrong.

You will meet with the founder to go through what you wrote. Expect honest comments on every question.$t$,
  responsibilities = array[
    $t$Write practical challenges and questions for one career stream$t$,
    $t$Solve each one yourself first, and note where it is unclear or too easy$t$,
    $t$Review and fix existing questions that are wrong, outdated or ambiguous$t$,
    $t$Write short explanations that tell a student why an answer is right or wrong$t$,
    $t$Note which questions are too easy, too hard or unclear, and say why$t$,
    $t$Keep answers and explanations accurate$t$
  ],
  requirements = array[
    $t$You are a student or recent graduate with solid knowledge of one stream, such as data analysis, software, design or business$t$,
    $t$You write carefully and accurately$t$,
    $t$You enjoy finding mistakes, including your own$t$,
    $t$You can commit steady hours each week for the length of the internship$t$,
    $t$You are comfortable giving and receiving direct feedback$t$
  ],
  nice_to_have = array[
    $t$Experience tutoring or mentoring others$t$,
    $t$A project or portfolio in your stream$t$,
    $t$Knowledge of a second stream$t$,
    $t$Comfort with spreadsheets for tracking your questions$t$
  ],
  first_months = array[
    $t$Week one: learn how a question becomes a challenge by solving a few existing ones$t$,
    $t$Weeks two to four: write your first set of questions and review each with the founder$t$,
    $t$Month two: take ownership of one topic area and keep it accurate$t$,
    $t$Ongoing: review other people's questions and tell us what to improve next$t$
  ],
  interview = $j$[
    {"title": "Send proof", "body": "Your three questions from the brief under Your first proof, with the answers. Use the form or email careers@capabilio.online."},
    {"title": "We read it", "body": "We try to answer your questions and try to break them."},
    {"title": "Fix a flawed question", "body": "A short exercise on a topic we choose: find what is wrong with a question and fix it."},
    {"title": "Talk it through", "body": "We talk about what you wrote and how you think about fairness in a question. Either way, you hear the answer from us."}
  ]$j$::jsonb
where slug = 'assessment-content-intern';

-- Campus Growth Intern
update public.job_openings set
  about = $t$Capabilio grows when students try it and tell other students. Behind every college we work with is a group of students who first heard about it from someone they trust. You will be that person on your own campus and in your own network.

You will help introduce Capabilio to students and their colleges, learn what makes people sign up and keep coming back, and report honestly what works and what does not. Nothing here is a script: the plan is to try small things, measure them and keep what works.

You will work with the founder and, as the team grows, the partnerships team, and learn how a product earns its first users. It is an unpaid internship, so we keep the scope clear and the learning real.$t$,
  day_to_day = $t$A week usually has three parts.

Reaching out: introducing Capabilio to a club, a class or a group chat, and answering questions from students who are curious or unsure.

Measuring: counting how many people actually signed up and came back, not how many said they liked it.

Reporting: a short written note on what you tried, what happened and what you would do next. If something did not work, say so; that is useful to us.$t$,
  responsibilities = array[
    $t$Introduce Capabilio to students on your campus and in your network$t$,
    $t$Help students get started and answer their questions$t$,
    $t$Run small, honest outreach experiments and write down what worked and what did not$t$,
    $t$Write a short weekly note on what you tried and what happened$t$,
    $t$Collect student feedback and share it with the product team$t$,
    $t$Support introductions and follow-ups with colleges$t$
  ],
  requirements = array[
    $t$You are a current student or recent graduate$t$,
    $t$You are comfortable talking to people and writing clearly$t$,
    $t$You are reliable: you do what you said you would$t$,
    $t$You report numbers honestly, including the disappointing ones$t$,
    $t$You can commit steady hours each week for the length of the internship$t$
  ],
  nice_to_have = array[
    $t$You have led or organised a club, community or event$t$,
    $t$Content or social media skills$t$,
    $t$Knowledge of how colleges in your region make decisions$t$
  ],
  first_months = array[
    $t$Week one: learn the product as a student and try every step yourself$t$,
    $t$Weeks two to four: run your first small outreach experiment and report the numbers$t$,
    $t$Month two: repeat what worked and drop what did not$t$,
    $t$Ongoing: introduce us to the right person at your college$t$
  ],
  interview = $j$[
    {"title": "Send proof", "body": "Something you organised or grew, however small: an event, a club, a community or a campaign. Tell us what happened."},
    {"title": "We read it", "body": "We look at what you did yourself and what you measured."},
    {"title": "Plan for one group", "body": "The brief under Your first proof: how you would introduce Capabilio to one group, what you would measure, and what you would do if nobody signed up."},
    {"title": "Talk it through", "body": "We go through your plan together. Either way, you hear the answer from us."}
  ]$j$::jsonb
where slug = 'campus-growth-intern';

-- Engineering Intern
update public.job_openings set
  about = $t$You will work on the real Capabilio codebase, a production TypeScript app used by students, and learn how it is built and kept safe. This is not a practice project: your changes can ship.

You will work with the founder, learn how a feature goes from idea to production, and get direct review on every change. We care about tests, clear code and honest bug reports, so those are the habits you will practise.

It is an unpaid internship, so we keep the scope clear, start with small well-defined tasks and make sure you learn something real from each one.$t$,
  day_to_day = $t$Most work starts small: a bug with a clear way to reproduce it, a missing test, a confusing error message, or a loading state that feels broken. You read the code around it, make the change, write or update the test, and open it for review.

As you get comfortable the tasks grow into small features. Along the way you will learn how we handle sign-in, data access and secrets, and why each of those is done the way it is.

When you are stuck, ask early. A question after twenty minutes is better than silence after two days.$t$,
  responsibilities = array[
    $t$Fix bugs and ship small, well-tested features$t$,
    $t$Add tests for behaviour that is not covered yet$t$,
    $t$Improve error messages, accessibility and loading states$t$,
    $t$Write clear bug reports and pull request descriptions$t$,
    $t$Read code and ask questions until you understand it$t$,
    $t$Learn how authentication, data access and secrets are handled, and why$t$
  ],
  requirements = array[
    $t$You can write TypeScript or JavaScript and have built at least one project$t$,
    $t$You know basic Git and SQL$t$,
    $t$You can explain what you built and what you would change$t$,
    $t$You ask for help early and take review comments well$t$,
    $t$You can commit steady hours each week for the length of the internship$t$
  ],
  nice_to_have = array[
    $t$React or Next.js$t$,
    $t$Open-source contributions$t$,
    $t$Experience writing tests$t$,
    $t$Some Postgres experience$t$
  ],
  first_months = array[
    $t$Week one: set up the project locally and make a first small fix$t$,
    $t$Weeks two to four: ship a few small, tested changes$t$,
    $t$Month two: take a small feature from idea to review$t$,
    $t$Ongoing: pick up bugs and tests alongside the founding engineer$t$
  ],
  interview = $j$[
    {"title": "Send proof", "body": "A link to a project you built, with a short note on one bug you found late and how you found it."},
    {"title": "We read it", "body": "We read your code and your note."},
    {"title": "Write the test", "body": "The brief under Your first proof: describe the test that would have caught your bug, and write it if you can."},
    {"title": "Talk it through", "body": "We go through your project and your test together. Either way, you hear the answer from us."}
  ]$j$::jsonb
where slug = 'engineering-intern';
