# Path separation plan

Status (latest): migrations 200 applied; 201 (mentor slots, alerts) written and not applied. Status (updated): migrations 196 pulse, 197 sign-up trigger, 198 workspace (skills, vault, tracker, feedback) and 199 mentorship are WRITTEN and not yet applied; the landing page keeps the "coming soon" banner for Working Professional until every check passes. Earlier: Phase 1a applied 2026-11-16; Phase 1b written as migration 196 (`pro_posts`, `pro_post_likes`, `pro_post_comments`, `pro_follows`, `pro_reports`) and NOT yet applied, the professional Pulse page shows a plain error until it is; Phase 0 boundary test added (`lib/professional/boundary.test.ts`); static preview removed (backup kept outside the repo) (migration 195, `pro_profiles` / `pro_employment` / `pro_resumes` / `pro_verification`, one existing professional copied across). Everything else below is still a proposal. Isolation chosen: prefixed tables in `public`, one login. Written after the owner asked for students, recently graduated, professionals and organisations to be fully separate: own pages, rules, workflows and data.

## Where things stand

- **One identity.** `auth.users` and `profiles` hold everyone. A path is `profiles.primary_role` plus `profiles.student_status` (`student` | `graduate` | `professional`). Migration 005 chose this on purpose: a person gains a context without forking their identity.
- **Organisations are already mostly separate.** They have their own role kinds, `/org` and `/company` routes, and `org_*` tables (posts, follows, threads, chat, events).
- **Students and graduates share almost everything**: assessment, arena, roadmap, vault, SkillStudio and Pulse tables are keyed by user id with no path column.
- **Professionals have almost nothing of their own**: `employment_history`, `professional_context`, `graduate_resumes` (the resume reader), and the new `/professional` pages.
- **Pulse is one network** for every account: `follows`, `stories`, `community_*`, `dm_*`, `user_blocks`, `notifications`, `pulse_*`.
- **Sign-up trigger** `handle_new_user` accepts only `student` and `graduate`; professionals sign up as graduates and are moved by `markEmployed`.

## What stays shared (and why)

Login, password, email, 2FA, sessions, account deletion and the data export. These are security, not product. Splitting them means a person with two roles holds two logins. Everything else is per path.

## Target design

1. **Per-path tables, one identity.** Each path owns its tables under a prefix: `stu_*`, `grad_*`, `pro_*`; organisations keep `org_*`. Each table is reachable only through that path's code and covered by RLS that checks the account's path.
2. **Per-path code.** `lib/student`, `lib/graduate`, `lib/professional`, `lib/org`, with matching `components/` and `app/(app)/<path>/` route trees. A lint rule fails the build when one path imports another's module.
3. **A route ownership map.** Every route belongs to exactly one path. A test fails when a route is unowned, owned twice, or listed in another path's navigation.
4. **Per-path Pulse.** Posts, comments, likes, follows, stories and messages are separate tables per path, so a professional never sees a student's post and the reverse.
5. **A path is set once at sign-up** and cannot be changed by the person. A move (student to graduate to professional) is an explicit server action that copies what carries over and leaves the old path's data in place.

## Order of work

| Phase | What | Risk |
|---|---|---|
| 0 | Boundary contract: route map, import rule, tests. No data changes. | None |
| 1 | Professional: `pro_profile`, `pro_employment`, `pro_documents`, `pro_verification` (EPFO window), `pro_posts` and the rest of Pulse, `pro_job_applications`. Sign-up writes these directly. | Low: new tables, new users |
| 2 | Graduate: split from student. `grad_*` tables for resume, job hunt, plan, vault, Pulse. Copy existing graduate rows across. | Medium: live users |
| 3 | Student: confirm nothing from the other paths leaks in; move Pulse to `stu_*`. | Medium |
| 4 | Organisations: audit what students and professionals expose to them, and make that an explicit per-path share. | Low |

## Rules for every migration

- Written as files first, reviewed, then applied by the owner. Nothing is applied automatically.
- Additive first: new tables and a copy. Old tables are dropped only after a release has run on the new ones.
- Each migration comes with a rollback note and a row-count check.

## Open decisions

1. How to isolate: prefixed tables in `public` (recommended), separate Postgres schemas, or separate databases.
2. Which existing accounts move into new tables, and when.
3. Where a professional's skills come from, with no assessment.
4. Whether a person may ever hold two paths at once.
