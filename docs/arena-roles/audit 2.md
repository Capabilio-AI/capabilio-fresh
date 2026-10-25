# Arena roles: Phase 0 audit (2026-10-22)

Everything here was read from the code or queried from the live Supabase project (`gudsoflidkkmtnxvzicw`) on 2026-10-22. Nothing is taken from older docs.
Branch: `feat/arena-roles-it01-data-analyst` (from `origin/main` c864281).

## Two ticket systems serve Domain

| | A. Role workstations | B. Catalog tickets |
|---|---|---|
| Tables | `arena_domain_roles`, `arena_skill_areas`, `arena_domain_assignments`, `arena_skill_ratings`, `arena_rotation_state` | `arena_challenges` (`track=domain`, `user_id is null`), `challenge_careers`, `workstation_templates`, `runtime_settings` |
| Tickets | generated per student, graded by the server (`lib/arena-workstations/*`) | fixed, reviewed rows (`lib/arena-challenges/domain-set.ts`) |
| Role match | career name vs `match_keywords` substring | `challenge_careers` link |
| Live data | 9 enabled roles, 10 tool types | 4 careers x 3 published tickets; 14 published with no career link (never served); 30 retired |

`app/(app)/arena/challenges/domain/page.tsx` tries B first. A is used only when B returns no items and no cooldown (`hasLegacyWorkstation`).

## Confirmed defects

1. **B hides A for Data Analyst, Cloud Engineer, AI/ML Engineer.** Each has 3 published catalog tickets, so until all are passed the student sees a one-tool catalog ticket, not the multi-tool workstation. (Full Stack has catalog tickets only.)
2. **Silent role fallback.** `pickActiveRole` ends in `roles[0]`, which is `data-analyst` (ordered by `created_at`). `getWorkstationState` returns `not_started` for a student with no match, and `DomainWorkspace` then offers "Start as a Data Analyst" with the student's real target role shown above it. `startNextAttempt` only rejects `active`, `cooldown` and `unavailable`, so `POST /api/arena/domain/attempts` generates a Data Analyst ticket for any such student. The UI discloses it, but it is still a substitution. The fallback is asserted as intended behaviour in `lib/career/higher-studies-switch.test.ts:23`, so changing it needs a decision.
3. **Backend Developer is not live.** `supabase/migrations/113_backend_role.sql` defines the role, career and 5 areas, but `arena_domain_roles` and `careers` have no `backend-developer` row. `list_migrations` stops at 069 then jumps to 119 while roles from 104-112 are live, so migration history cannot be trusted; check table contents, not the list.
4. **Keyword matching is substring-based.** `matchRoleForStatedCareer` uses `includes` over a keyword list. Overlaps seen: "Data Scientist" maps to `ai-ml-engineer`; `cloud` alone matches the Cloud role; `analytics` alone matches Data Analyst. Business Analyst, Cybersecurity Analyst, Embedded Systems, Product Designer and Product Manager match nothing.
5. **Python workspace disabled.** `data-analyst/python` has `enabled=false` and no registered server tool. `docs/workstation-progress.md` records it as blocked on an isolated executor. `TERMINAL_VM` and `SIMULATOR` runtimes are also disabled.
6. **Stale doc.** `docs/workstation-progress.md` lists five tools; the registry has ten.
7. **Finder duplicates.** Untracked files named `* 2.ts`, `* 3.ts` etc. exist under `app/`, `lib/`, `components/`, `supabase/migrations/`, `.next/`. None are tracked (`git ls-files | grep " 2\."` is empty). They break `tsc` through `.next`.

## Baseline (local, this machine)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 37 errors, all in untracked `.next/**` duplicate files (`routes.d 2.ts`, `3`, `4`); 0 errors in source |
| `npx vitest run` | 236 files pass, 1 fails: 1913 of 1914 tests pass |
| failing test | `lib/workplace/ml/ml.test.ts` "leakage ticket ...": timed out at 30 s under full-suite load; passes alone in 10 s (9 of 9). Flaky under load, not a logic failure |
| lint, `next build`, `test:live` | not run in Phase 0 |
| browser / e2e | none exist in the repo (no Playwright config); not run |

## Live Data Analyst workstation (system A)

Areas enabled: sql, spreadsheet, dashboard, statistics, data_cleaning, debugging (sql), investigation, incident. Disabled: python.
Tools and how each grades:

- `sql_workspace`: runs in a local in-browser/worker SQLite runner (`lib/workplace/sql/local-runner`); server grades result sets against its own reference.
- `spreadsheet_workspace`: in-house formula engine, shared by grid and grader.
- `dashboard_workspace`: spec evaluated on the dataset, series compared.
- `statistics_workspace`, `cleaning_workspace`: server-computed answer keys.
- `investigation_workspace`: free SQL exploration, only the findings are graded.

Level gating (`AREA_MIN_LEVEL`): investigation needs junior, incident needs mid.

## Not yet verified

- That each Data Analyst tool works end to end in a browser (never clicked through in this work).
- RLS on `arena_domain_assignments` and `arena_challenges` instances (a live security test exists: `lib/arena-workstations/security.live.test.ts`; not run).
- Plan B unlock, graduate/professional skip and the 24 h cooldown under timezone and concurrency cases.
- The generation path calls Groq (`GROQ_MODEL`) while the README says Claude is primary; which is live for Domain was not checked.

## Order of work

IT-01 Data Analyst first (see `implementation-log.md`). No other role starts until IT-01 passes its gate.
