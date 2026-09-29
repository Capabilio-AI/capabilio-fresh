# Arena rating scale mismatch — needs a dedicated fix

**Status:** open, unfixed, **out of scope of the Job-Track / Curriculum-Roadmap work by decision.** Written up here so it can be picked up as its own task. The owner will decide between the options below.
**Found:** during the curriculum-roadmap audit (2026-09-29). **Verified against:** the production database and the repo working tree.

## The problem in one paragraph
Domain (workstation) Arena ratings now **start at 400**, but the machinery that consumes the rating still assumes the old **1200** scale: the rating-update formula compares against a fixed 1200 "opponent", and the difficulty bands are `easy < 1250 ≤ medium < 1400 ≤ hard`. Nothing in the 400 → 1250 range can ever be served as anything but *easy*, and it takes dozens of verified tasks to cross it. New students therefore never leave the easiest tier in practice.

## Evidence (all from code / production)
| fact | where |
|---|---|
| New rows default to 400 | migration `027_arena_rating_baseline_400.sql` (`arena_skill_ratings.rating default 400`). Rows seeded from the assessment start at `min(700, 400 + avg·3)` (`lib/capability/seed-arena-rating.ts`) |
| Difficulty bands assume ~1200 | `difficultyForRating` in `lib/arena-workstations/types.ts`: `<1250 easy`, `<1400 medium`, else `hard`; and `attempts.ts:147` falls back to **1200** when no rating row exists |
| Rating update uses a fixed 1200 reference | `complete_workstation_attempt` (migration 025, the version **currently in production**): `expected = 1/(1+10^((1200 − r)/400))`, `delta = round(32·(1 − expected))` |
| Stream uses a different baseline | `lib/arena/elo.ts` `BASELINE_RATING = 1200` (Stream) vs 400 (Domain) |
| Portfolio tiers are on the 400 scale | `lib/portfolio/elo.ts` tier table (e.g. "Expert" 1000–1200, "Master" 1200–1500) |
| One legacy row is on the old scale | production `arena_skill_ratings`: one row at 1216 (created under the 1200 default) — 3 tasks from medium, while every new row is ~34 |

## What it does to real students (simulated with the production RPC's own formula)
Verified tasks needed *in one skill area* to reach a difficulty band:

| starting rating | to medium (1250) | to hard (1400) |
|---|---|---|
| 400 (default) | **34** | **48** |
| 700 (max assessment seed) | 24 | 38 |
| 1216 (the one legacy row) | 3 | 17 |

Tasks are handed out one per role per 24 hours, rotating across five areas, so 34 tasks in one area is on the order of **170 days**. Medium and hard are effectively unreachable within an academic year, and old and new rows behave completely differently.

## A pending change makes it worse (not applied — read before deciding)
The repo working tree contains an **untracked, unapplied** migration `029_arena_track_separation.sql` (and uncommitted code that already reads its new tables `arena_domain_stats`, `arena_stream_stats`, `arena_stream_weeks`, none of which exist in production). It replaces the Domain rating update with a **fixed per-difficulty step (+8 easy / +12 medium / +15 hard)** and no longer uses the 1200 formula at all. From 400 that is ≥ 107 easy tasks to reach 1250 — and since easy is the only tier served below 1250, medium/hard would be unreachable. Whoever owns 029 should treat this document as an input to it. (Separately, the code reading tables that production lacks is a deployment-ordering risk independent of this issue.)

## Other symptoms
- The UI labels `+8 / +12 / +15` (`ELO_BY_DIFFICULTY`, stored as `points`) while the stored rating actually moves by the formula above (≈ +32 near 400) — the two disagree today.
- Anything comparing Stream and Domain ratings is comparing different scales.

## Not affected
- The curriculum roadmap: readiness there is a minimum **verified attempt count** per skill area (`verified_count`), deliberately not rating-based, because of this issue.
- Evidence and verification: unaffected; they do not depend on the rating scale.

## Options (owner decides; not chosen here)
1. **Rescale the difficulty bands to the 400 baseline** (e.g. medium/hard thresholds relative to 400) and change the `1200` fallback in `attempts.ts` — leaves the update formula's reference at 1200, so K=32 gains at the low end stay large.
2. **Change the reference rating in the update formula to 400** (or the baseline) so gains are ~+16 at baseline and the existing bands would need to move with it.
3. **Restore a 1200 baseline** (revert migration 027) — simplest for the engine, but moves the Portfolio tier scale and the "matches capabilio-web" baseline decision.
Whichever is chosen: decide the fate of 029's fixed-step model at the same time; migrate or explicitly grandfather the one 1216 row; align the displayed `+N` with the real delta; and add a test that a fresh student can, in principle, reach each difficulty band within a defined number of tasks.
