# Evidence Strength — the deterministic formula

Per the brief's Phase 4 rule: strength is only shown when computed by a documented, deterministic
formula; otherwise a factual label ("Insufficient evidence"), never a fabricated number.

## Why this lives at capability level, not the per-row `evidence.strength` column

`evidence.strength` (added by `018_evidence_unification.sql`) stays **null on every row written
by this pass**, deliberately. The brief's own factor list — "number of independent items,
recency, repetition... cross-source corroboration" — describes properties of a *group* of
evidence for one skill, not a single row in isolation. A per-row number computed from only that
row's own facts would either duplicate `confidence` (already a per-row field, capturing
directness/source reliability at ingestion time) or be misleading (a single commit_activity row
can't know whether it's corroborated by an Arena result without seeing the group). The column is
kept, nullable, for a future per-row use if one is ever well-motivated; it is not populated by
this pass's writers.

The real, deterministic formula computes **capability strength** — one number per
`DemonstratedCapability`, in `lib/evidence/aggregate-capabilities.ts`, from exactly the rows
already grouped for that skill. Never AI-computed; pure arithmetic over stored facts.

## The formula

```
strength = clamp(0, 100,
  directness(items)
  + repetition(evidenceCount)
  + recency(mostRecentAt)
  + corroboration(sourceMix)
)
```

- **directness** — the strongest evidence type present for this skill sets the floor:
  `commit_activity` (real, attributed code changes) = 40, `arena_result` (a controlled, verified
  assessment) = 35, `technology_usage` (file/dependency presence — real, but weaker proof of
  applied skill than actually shipping commits) = 25. Take the max across the group's items, not
  a sum — directness answers "how direct is the *best* evidence here," not "how many kinds."
- **repetition** — `min(evidenceCount - 1, 5) * 5`, i.e. up to +25 for five or more independent
  items beyond the first. Capped so a skill backed by 50 near-identical evidence rows (e.g. many
  small commits in one repo) doesn't crowd out a skill backed by fewer, more meaningful items.
- **recency** — the group's most recent `observedAt`: +15 within 90 days, +5 within 365 days,
  +0 beyond that or if unknown. A skill last demonstrated two years ago is real but weaker
  evidence of *current* ability than one demonstrated last month.
- **corroboration** — +20 when the source mix spans more than one `source_type` (e.g. both
  `github_repository` and `arena_challenge` back the same skill) — independent systems agreeing
  is stronger evidence than one system alone, exactly the "cross-source corroboration" factor.

Not modeled as separate terms: "number of independent items" is `repetition` above (already
capped, not double-counted); "source reliability" is folded into `directness` (which source
each evidence type comes from is fixed by construction, so a separate reliability multiplier
would just be `directness` again under a different name); "candidate-specific attribution" is
enforced upstream, not scored here — `deriveGithubEvidence`/`deriveArenaEvidence` only ever
produce rows for the *candidate's own* commits/PRs/Arena attempts in the first place (never repo
activity by other contributors), so every row reaching this formula already satisfies
attribution by construction rather than needing a numeric adjustment.

## Display rule

`strength < 25` (evidence exists, but it's a single weak signal) renders as "Limited evidence,"
never the raw number — a two-digit score under a real threshold reads as more precise than it
is. `strength >= 25` shows the number with its constituent signals (source mix, evidence count,
recency) visible alongside it, never alone.
