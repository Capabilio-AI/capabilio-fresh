# The Capabilio Proof Model

One universal formula for everything Capabilio scores: an assessment answer, an Arena pass or fail, a project, later an interview. Written by the CTO for the founder's rule: **a student's numbers move only with real, verified work, and they move up and down on their own.**

## 1. What exists today (research, 2026-11-25)

Four separate calculations run side by side. They agree on the idea but not on the numbers, which is why a student can see "52% ready" while nothing is proven.

| # | Where | What it computes | Rule today |
|---|---|---|---|
| 1 | `lib/roadmap-visual/capability.ts` (v3) | a skill's level on the skill graph, Arena skill profile, badges | depth of proof: about 3 points per verified proof, 90 at 30 proofs, learning is not proof |
| 2 | `lib/assess/engine.ts` + `scoring.ts` | a skill's score after the assessment, and two readiness figures | item-response estimate; a multiple-choice answer is "screening" and can lift a skill to 40 at most; each passed practical task raises the ceiling by 15 |
| 3 | `elo_rules` + SQL `apply_elo_event` | the rating (ELO) | flat: every right answer +4, every wrong answer -2, Arena the same; no difficulty, no opponent, no per-skill rating |
| 4 | `lib/career/skill-gap.ts` | skill gaps and the older readiness | required minus current, per skill |

**Why 52%:** the Skill gap page shows `profile.readiness`, the *screened* figure (every measured skill counted at up to 40, from sign-up answers alone). The same profile already holds `profile.proven`, which is 0 until a practical task is passed. The headline showed the wrong one. Fixed in this change: the headline is now Proven readiness, and the assessment figure is shown as the starting point.

**Why Deep Learning is "Not assessed":** it is not missing content (64 questions and an Arena area exist). The sign-up assessment samples a limited number of questions, so with 15 skills some are never asked. That is a *coverage* rule problem, not a formula problem.

**Content gaps (real, measured):** counting skills that have no assessment question and no enabled Arena area:
- Data Scientist: 15 skills, 0 without questions, 5 without an Arena area (Hypothesis Testing, EDA, Probability, Data Storytelling, Linear Algebra).
- Larger gaps elsewhere: application-developer 21 of 42 skills without questions and 40 without an Arena area; database-admin 19 of 33 and 30; frontend-developer 16 of 31 and 31; backend-developer 16 of 30 and 26; and about a dozen more roles above 10.

## 2. Is one formula possible? Yes, and without redoing everything

All four are *functions of evidence*. If the evidence is kept (it is: assessment answers, Arena attempts, projects, ELO events) then any number can be recomputed from it. The proof: capability v3 changed every student's skill levels with **no data migration**, because levels are computed on read.

So the design is: **one evidence ledger, one pure model, versioned parameters, every screen reads the model.**

```
evidence ledger  ->  Proof Model (pure, versioned)  ->  skill state  ->  role readiness  ->  rating
 (never edited)       params in ONE file                  skill graph       gap analysis       ELO
```

Changing a number later means editing one parameter file and bumping the version. Nothing is migrated, nothing is rewritten.

## 3. The formulas

Notation: student *s*, skill *k*, evidence item *i* with difficulty rating `D_i` (easy 800, medium 1000, hard 1200; Arena items carry their own).

**3.1 Skill rating** (this is the Elo part; start `R = 400`)

```
E_i   = 1 / (1 + 10 ^ ((D_i - R_k) / 400))        expected chance to pass at this rating
S_i   = 1 if passed / correct, else 0
R_k  <- max(0, R_k + K_kind * (S_i - E_i))
```

A pass raises the rating, a fail lowers it, a hard item moves it more than an easy one, and an item far below your rating moves it very little. This is real Elo, per skill. `K_kind` says how much an item of that kind is worth: multiple-choice screening 8, Arena task 32, project 40, interview with live challenge 48. **A wrong answer gives no points.** It lowers the rating a little (so we know the weakness) and adds nothing to depth.

**3.2 Depth of proof** (how much real work stands behind the skill; this is capability v3)

```
W_k      = sum over verified items of weight_kind * recency * difficulty        weight: Arena pass 1, project 3, screening-correct 0.25, wrong 0
ceiling  = min(90, 3 * W_k)                                                     100 only after a verified interview with a live challenge
```

**3.3 Skill level** (the number on the skill graph)

```
f(R)     = 90 * clamp((R - 400) / 800, 0, 1)                                    ability in 0..90
level_k  = min(f(R_k), ceiling)                                                 you cannot show more than you can prove, or more than you can do
```

Twenty multiple-choice answers on one skill give `W = 5` at most (all correct), so `ceiling = 15`: an assessment alone can never read like mastery. Thirty recent Arena passes at a rating near 1200 reach 90.

**3.4 Role readiness** (what the Skill gap page headlines)

```
proven readiness   = sum_k w_k * min(1, level_k / target_k) / sum_k w_k        every skill of the role, unmeasured counts as 0
assessment start   = the same, using screening evidence only                    shown as "where you started", never as readiness
```

**3.5 Rating shown to the student (ELO)**

```
ELO_career = 400 + sum_k w_k * (R_k - 400) / sum_k w_k
```

The career ELO is the weighted mean of the skill ratings of the role. It is not a second ledger. A passed challenge moves one skill rating, which moves the skill level, the skill graph, the gap analysis and the ELO together, and a failed one moves them down the same way. Nothing can disagree because nothing is stored twice.

## 4. Coverage guarantees (the "no skill missing" rule)

1. **Assessment:** the planner must ask every skill of the role at least once before it goes deeper on any (breadth pass, then adaptive depth). With 15 to 40 skills this means a longer first pass or a staged assessment (core skills now, the rest in the first week). A skill that was not asked is labelled "not assessed yet" and is scheduled, never silently dropped.
2. **Arena after the modules:** one role challenge a day. Skill choice: the skill with the fewest proofs relative to its target. Items never repeat for a student while unseen items remain. The next one unlocks 24 hours after the last is finished.
3. **Content audit gate:** a role is not offered unless every skill has questions and an Arena area. The audit above becomes a CI check, so a gap is a failing build, not a surprise on a student's screen.

## 5. Portfolio rule

The portfolio shows **only proven work**: badges need 5, 15 and 25 pieces of real work. Learning a lesson is never shown as a skill. The assessment start is shown separately and labelled as a starting point.

## 6. Rollout, in order

| Step | What | Needs the database? |
|---|---|---|
| 0 (done) | capability v3 depth; headline readiness is the proven figure | no |
| 1 | Put 3.1 to 3.5 in one module `lib/proof-model` with one parameter file and tests; make capability, assessment scoring and the gap page call it | no |
| 2 | Derive the rating from the evidence on read (replay the existing ELO events and attempts through 3.1); keep the SQL ledger as an audit trail | no |
| 3 | Coverage planner for the assessment and the Arena daily choice; CI content audit | no |
| 4 | Fill the content gaps with the authoring pipeline (questions and Arena areas for the roles in the audit) | no |
| 5 | The verified interview with a live challenge that lifts the cap from 90 to 100 | yes, a table for interview records |

## 7. Honest limits

- Item difficulty ratings start as easy/medium/hard constants; they can be calibrated from real results once there are enough attempts.
- The Arena daily choice depends on the content audit: a role with no tickets for a skill cannot be fully covered until Step 4.
- Until Step 5 nothing shows above 90, and the interface says so.
