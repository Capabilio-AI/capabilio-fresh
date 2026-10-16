# Role spec: AI / ML Engineer

Status: proposal for review. Nothing built. Part of the one-by-one role rollout (see `docs/ticket-bank-design.md`).

## Core idea: grade outputs, never run user code on the server

The earlier `python_workspace` tool was left disabled because grading code that runs in the browser can be faked, and a server executor is heavy. So:

- The user works in the browser (Pyodide worker, already in `lib/arena-runtime/client/python-runner.ts`; numpy, pandas, scikit-learn, scipy available).
- They submit **outputs**, not code: predictions for hidden test rows, computed numbers, or function outputs on hidden inputs.
- The server holds the answers (test labels, reference outputs) and grades. A user cannot read what was never sent to the browser.
- The "explain your work" interview (Step 5, already built) is the check that the person understood what they submitted.

## Data: seeded synthetic worlds (like BrightCart)

A TypeScript generator per scenario (churn, loan default, delivery time, demand forecast), seeded per user and ticket:
- `train`: features + label, sent to the browser.
- `test`: features only, sent to the browser. Test labels stay on the server.
- ≤ 5,000 rows, so Pyodide stays fast.
- The generator knows the true process, so the server can score the **ceiling** (the true probability or value on the test rows) with no ML on the server. Baseline = majority class or mean. Pass threshold = baseline + a fraction of (ceiling − baseline): easy 0.35, medium 0.5, hard 0.65. Expert tickets also set a fairness or calibration target.

## Skill areas (role `ai-ml-engineer`)

| Area | Ticket | What is submitted | Server check |
|---|---|---|---|
| `data-preparation` | clean and encode a raw table (missing values, outliers, categories, scaling) | summary numbers of the prepared matrix (column means, row count, encoded category counts) | recomputed in TypeScript on the same seed, with tolerance |
| `model-training` | train a classifier or regressor | predictions for the test rows | metric vs threshold from baseline and ceiling |
| `evaluation` | choose and compute the right metric (imbalance, cost-sensitive threshold, calibration) | numbers and a choice | exact or tolerance match with the reference |
| `pipeline-debugging` | broken notebook (leakage, wrong split, scaling before split, wrong metric) opened as starter code | the honest validation score and test predictions | reported score near the honest score (a leaky run reports an inflated one) and the predictions metric |
| `ml-fundamentals` | implement an algorithm in NumPy (gradient descent, softmax, k-means step, KNN) | its outputs on hidden inputs | equal to reference outputs |
| `feature-engineering` | add features to beat a plain baseline | predictions | must beat the plain-features baseline by a margin |

Level gating: `pipeline-debugging` from junior, `evaluation` metric-cost tickets from mid, calibration and fairness from expert (same `minLevel` mechanism as SQL).

## Leakage traps (the interesting tickets)

`train` contains a column derived from the label (for example `refund_issued`), absent or constant in `test`. A model using it scores well locally and badly on the test rows. The server sees it only through the metric, so no code inspection is needed.

## Anti-cheating

- Submissions per ticket are limited (3). Feedback is pass or fail plus a coarse band, never the exact metric, so labels cannot be probed by hill-climbing.
- Predictions must have exactly the right length and valid values, or the server rejects them.
- Test rows are shuffled with ids the user cannot map to anything else.

## Limits to accept

- Pyodide has no PyTorch or TensorFlow, so deep learning and LLM work are covered only at the NumPy-from-scratch level in v1. A later GPU or hosted-notebook runner can add them.
- Package download is slow on first load. The worker caches after the first start.

## Build plan

1. Migration 108: role `ai-ml-engineer`, careers row (needed for the ELO ledger), the six areas, `tool_type = ml_workspace`.
2. `lib/workplace/ml/`: seeded generators, ceiling and baseline scoring, metric functions (accuracy, F1, AUC, RMSE) with tests.
3. `lib/arena-workstations/tools/ml.ts` (server tool: generate, grade) and `components/arena/workstations/MlTool.tsx` (notebook UI on `PythonRunner`).
4. Ticket templates per area, validated the same way as SQL (reference passes, common mistake fails, doing nothing fails).
5. Tests: generators are deterministic; grading accepts the ceiling predictions and rejects baseline and leaky ones.

## Open questions

- OK to cap submissions at 3 per ticket?
- OK that deep learning is out of scope for v1?
