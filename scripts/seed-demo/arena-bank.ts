// DEMO DATA. Arena tickets for the two demo students: the brief, the work submitted, how each check went, and the "explain your work" interview.
// Every number comes from a seeded generator, so a re-run writes the same tasks. Failed tickets are included on purpose: they show real misses.
import { rngFor } from "./rng";

export type Difficulty = "easy" | "medium" | "hard";

export interface TaskSpec {
  roleKey: "data-scientist" | "ai-ml-engineer";
  areaKey: string;
  title: string;
  company: string;
  requester: string;
  difficulty: Difficulty;
  toolType: "ml_workspace";
  scenario: string;
  objective: string[];
  code: string;
  checks: { label: string; passed: boolean }[];
  passed: boolean;
  message: string;
  /** days before today that the ticket was closed */
  daysAgo: number;
  minutes: number;
  interview: { score: number; passed: boolean; questions: string[]; answers: string[]; strengths: string[]; improvements: string[]; notes: string[] };
}

interface Case { company: string; requester: string; entity: string; target: string; table: string; unit: string }
const CASES: Case[] = [
  { company: "Northwind Retail", requester: "Meera Iyer, Head of CRM", entity: "customer", target: "churned", table: "customers", unit: "customers" },
  { company: "Lumen Bank", requester: "Arjun Nair, Credit Risk Lead", entity: "loan", target: "defaulted", table: "loans", unit: "loans" },
  { company: "Medico Health", requester: "Dr. Kavya Menon, Clinical Analytics", entity: "patient", target: "readmitted_30d", table: "admissions", unit: "admissions" },
  { company: "Swift Logistics", requester: "Imran Sheikh, Operations Manager", entity: "shipment", target: "delayed", table: "shipments", unit: "shipments" },
  { company: "Orbit Telecom", requester: "Divya Krishnan, Retention Lead", entity: "subscriber", target: "churned", table: "subscribers", unit: "subscribers" },
  { company: "GreenGrid Energy", requester: "Sanjay Patel, Planning Analyst", entity: "meter", target: "peak_load_kw", table: "meter_readings", unit: "readings" },
  { company: "Atlas Insurance", requester: "Nisha Bhatt, Claims Analytics", entity: "claim", target: "is_fraud", table: "claims", unit: "claims" },
  { company: "Vista Airlines", requester: "Rahul Verma, Revenue Management", entity: "booking", target: "no_show", table: "bookings", unit: "bookings" },
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const SEEDS = (key: string, n: number) => rngFor("arena", key, String(n));

interface Built { title: string; scenario: string; objective: string[]; code: string; checks: string[]; strengths: string[]; improvements: string[]; questions: string[]; answers: string[] }
type Builder = (c: Case, r: () => number, n: number) => Built;

const AREA_BUILDERS: Record<string, Builder> = {
  "exploratory-analysis": (c, r) => {
    const miss = 4 + Math.round(r() * 9);
    return {
      title: `Profile the ${c.table} table and find where ${c.target} concentrates`,
      scenario: `${c.requester} has handed over an extract of ${c.table} and wants to know what is driving ${c.target} before any model is built. The extract has missing values and a few suspicious rows.`,
      objective: [`Report the share of missing values per column`, `Find the segment with the highest ${c.target} rate`, `Flag outliers that would distort a model`],
      code: `import pandas as pd\ndf = pd.read_csv("${c.table}.csv")\nprint(df.isna().mean().sort_values(ascending=False).head(5))\nseg = df.groupby("segment")["${c.target}"].mean().sort_values(ascending=False)\nprint(seg.head(3))\nq1, q3 = df["amount"].quantile([.25, .75]); iqr = q3 - q1\nprint(((df["amount"] < q1 - 1.5*iqr) | (df["amount"] > q3 + 1.5*iqr)).sum(), "outliers")`,
      checks: [`Missing values reported per column (${miss}% worst column)`, `Highest-rate segment identified`, `Outliers counted with the IQR rule`, `No rows dropped without saying so`],
      strengths: ["Checked missing values before anything else", "Used a rule for outliers instead of eyeballing"],
      improvements: ["State how the missing values should be handled, not only how many there are"],
      questions: [`Why did you look at missing values first?`, `How did you decide which rows were outliers?`, `What would you do about the ${miss}% missing column?`, `What would you tell ${c.company} from this analysis?`],
      answers: [`A model silently learns from whatever is missing, so I needed to know how bad it was before choosing any method.`, `I used the IQR rule on amount because it does not assume a normal shape.`, `I would check whether it is missing at random, then impute with the median or add a missing flag.`, `That ${c.target} is concentrated in one segment, so the first action should target it.`],
    };
  },
  "feature-engineering": (c, r) => ({
    title: `Build features for predicting ${c.target} on ${c.table}`,
    scenario: `${c.company}'s ${c.table} table has raw timestamps and amounts. ${c.requester} wants features a model can use, without leaking the outcome.`,
    objective: [`Create a recency and a frequency feature`, `Encode the categorical columns`, `Keep the target out of every feature`],
    code: `df["days_since_last"] = (snapshot - df["last_event"]).dt.days\ndf["events_90d"] = df.groupby("${c.entity}_id")["event_id"].transform("count")\nX = pd.get_dummies(df.drop(columns=["${c.target}", "${c.entity}_id", "last_event"]), columns=["segment", "channel"])\ny = df["${c.target}"]\nassert "${c.target}" not in X.columns`,
    checks: [`Recency feature built from the snapshot date`, `Frequency feature built per ${c.entity}`, `Categoricals one-hot encoded`, `Target absent from the features`],
    strengths: ["Added an explicit check that the target is not in the features"],
    improvements: ["Compute the snapshot date from the training window so the features cannot look into the future"],
    questions: [`Why a recency feature?`, `What is target leakage and how did you avoid it?`, `Why one-hot encode instead of numbering the categories?`, `Which feature do you expect to matter most?`],
    answers: [`Recent activity is usually the strongest sign a ${c.entity} is still engaged.`, `Leakage is using information that would not exist at prediction time. I dropped the target and anything computed after the snapshot.`, `Numbering implies an order that is not there, and linear models would treat 3 as bigger than 1.`, `Recency, because behaviour just before the snapshot predicts ${c.target} better than older history.`],
  }),
  "model-building": (c, r) => {
    const base = 0.7 + r() * 0.08;
    const tuned = base + 0.03 + r() * 0.05;
    return {
      title: `Baseline and tuned model for ${c.target}`,
      scenario: `${c.requester} needs a first predictive model for ${c.target} at ${c.company}, with a baseline to beat so the value of tuning is clear.`,
      objective: [`Train a baseline logistic regression`, `Train a tuned tree model with cross-validation`, `Report both scores on held-out data`],
      code: `from sklearn.linear_model import LogisticRegression\nfrom sklearn.ensemble import GradientBoostingClassifier\nfrom sklearn.model_selection import train_test_split, cross_val_score\nXtr, Xte, ytr, yte = train_test_split(X, y, test_size=.2, stratify=y, random_state=7)\nbase = LogisticRegression(max_iter=500).fit(Xtr, ytr)\ntuned = GradientBoostingClassifier(n_estimators=250, learning_rate=.05, max_depth=3).fit(Xtr, ytr)\nprint("baseline AUC", ${base.toFixed(3)}, "tuned AUC", ${tuned.toFixed(3)})\nprint(cross_val_score(tuned, Xtr, ytr, cv=5, scoring="roc_auc").mean())`,
      checks: [`Stratified train/test split`, `Baseline model reported (AUC ${base.toFixed(2)})`, `Tuned model beats the baseline (AUC ${tuned.toFixed(2)})`, `Cross-validation used on the training set only`],
      strengths: ["Kept a baseline so the improvement can be judged", "Stratified the split because the classes are unbalanced"],
      improvements: ["Explain why the gain is worth the extra complexity"],
      questions: [`Why did you keep a baseline model?`, `Why stratify the split?`, `Where did cross-validation happen and why?`, `Would you ship the tuned model?`],
      answers: [`Without it I cannot say whether tuning helped or I just built something complicated.`, `${c.target} is the minority class, so a random split could leave the test set with very few positives.`, `Only on the training data, so the test set stays untouched until the final score.`, `Yes if the AUC gain holds on new data, and with monitoring for drift.`],
    };
  },
  "model-evaluation": (c, r) => {
    const th = 0.25 + Math.round(r() * 20) / 100;
    const prec = 0.62 + r() * 0.15;
    const rec = 0.58 + r() * 0.2;
    return {
      title: `Pick a decision threshold for the ${c.target} model`,
      scenario: `${c.company} will act on every ${c.entity} the model flags. ${c.requester} says missing a true case costs about 5 times more than a false alarm.`,
      objective: [`Compute precision and recall across thresholds`, `Choose the threshold that minimises expected cost`, `Explain the trade-off in one sentence`],
      code: `import numpy as np\nfrom sklearn.metrics import precision_recall_curve\np, r, t = precision_recall_curve(yte, proba)\ncost = 5*(1-r)*yte.sum() + (1-p[:-1])*(proba >= t).sum()\nbest = t[np.argmin(cost[:len(t)])]\nprint("threshold", ${th.toFixed(2)}, "precision", ${prec.toFixed(2)}, "recall", ${rec.toFixed(2)})`,
      checks: [`Precision and recall computed on the test set`, `Threshold chosen from cost, not left at 0.5 (${th.toFixed(2)})`, `Recall ${pct(rec)} at precision ${pct(prec)} reported`, `Trade-off explained in business terms`],
      strengths: ["Chose the threshold from the cost of errors instead of the default 0.5"],
      improvements: ["Show the cost curve so the choice can be checked by the business"],
      questions: [`Why not just use 0.5?`, `What does recall mean for ${c.company}?`, `What happens if the cost ratio changes?`, `How would you explain precision to a manager?`],
      answers: [`0.5 assumes both errors cost the same, which is not true here.`, `Of all the real cases, how many we catch. Missing them is the expensive error.`, `The best threshold moves, so I would recompute it from the new cost ratio.`, `Of the ones we flag, how many are really a problem. Low precision means wasted effort.`],
    };
  },
  "experiment-design": (c, r) => {
    const baseRate = 0.08 + r() * 0.07;
    const n = Math.round(1800 + r() * 3200);
    return {
      title: `Design an A/B test for a ${c.company} retention offer`,
      scenario: `${c.requester} wants to test a retention offer on ${c.unit}. The current ${c.target} rate is ${pct(baseRate)} and they want to detect a 2 point drop.`,
      objective: [`Compute the sample size per group`, `Decide the success metric and the guardrail metric`, `State what result would make you ship the offer`],
      code: `from statsmodels.stats.power import NormalIndPower\nfrom statsmodels.stats.proportion import proportion_effectsize\nes = proportion_effectsize(${baseRate.toFixed(3)}, ${(baseRate - 0.02).toFixed(3)})\nn = NormalIndPower().solve_power(es, power=.8, alpha=.05)\nprint(round(n), "per group")  # ${n}`,
      checks: [`Effect size from the two rates`, `Power 0.8 and alpha 0.05 stated`, `Sample size per group computed (${n})`, `Guardrail metric named`],
      strengths: ["Fixed the metric and the ship rule before running anything"],
      improvements: ["Mention how long the test must run to cover a full weekly cycle"],
      questions: [`Why decide the ship rule in advance?`, `What does power 0.8 mean?`, `What is a guardrail metric here?`, `What if the test is stopped early?`],
      answers: [`Otherwise it is too easy to read the result the way we hoped.`, `An 80% chance of detecting the effect if it is really there.`, `Something that must not get worse, like complaints or revenue per ${c.entity}.`, `Peeking early inflates false positives, so I would wait for the planned sample.`],
    };
  },
  "data-storytelling": (c, r) => {
    const lift = 8 + Math.round(r() * 14);
    return {
      title: `Turn the ${c.target} analysis into a one-page summary for ${c.company}`,
      scenario: `${c.requester} needs to present the result of the ${c.target} analysis to leadership, who are not technical. They have two minutes.`,
      objective: [`Lead with the decision, not the method`, `Use one chart that shows the main finding`, `Give one clear recommended action with its expected effect`],
      code: `summary = """\nDecision: target the top-risk segment first.\nEvidence: that segment has ${lift}% more ${c.target} than the average ${c.entity}.\nAction: send the retention offer there this month and measure for 4 weeks.\nLimit: based on 12 months of data; seasonality is not yet separated.\n"""\nax = seg.head(5).plot.barh(title="${c.target} rate by segment"); ax.set_xlabel("rate")`,
      checks: [`Leads with the decision`, `One chart with a clear title and axis`, `One recommended action with a time frame`, `States a limitation honestly`],
      strengths: ["Led with the decision and kept a single chart", "Stated a limitation instead of hiding it"],
      improvements: ["Add the expected size of the effect in money or customers"],
      questions: [`Why start with the decision?`, `Why only one chart?`, `What is the main limitation of this analysis?`, `How would you measure whether the action worked?`],
      answers: [`Leaders decide in seconds. The method can follow if they ask.`, `Two charts compete for attention. One makes the point.`, `Only 12 months of data, so seasonal effects are not separated yet.`, `Compare the ${c.target} rate of the offered segment against a held-out group over 4 weeks.`],
    };
  },
  // AI/ML Engineer areas
  "data-preparation": (c, r) => ({
    title: `Prepare the ${c.table} data for model training`,
    scenario: `${c.company}'s ML team receives ${c.table} from three sources with different formats. ${c.requester} needs one clean training table.`,
    objective: [`Unify the date and currency formats`, `Remove exact duplicate rows`, `Split into train, validation and test before any scaling`],
    code: `df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")\ndf["amount_inr"] = df["amount"] * df["currency"].map({"INR": 1, "USD": 83.2})\ndf = df.drop_duplicates()\ntrain, rest = train_test_split(df, test_size=.3, random_state=7)\nval, test = train_test_split(rest, test_size=.5, random_state=7)\nscaler = StandardScaler().fit(train[["amount_inr"]])`,
    checks: [`Dates parsed into one format`, `Currencies converted to one unit`, `Duplicates removed and counted`, `Scaler fitted on the training split only`],
    strengths: ["Fitted the scaler on training data only"],
    improvements: ["Log how many rows each cleaning step removed"],
    questions: [`Why fit the scaler on the training split only?`, `Why convert currencies before modelling?`, `What did you do about unparseable dates?`, `How would you keep this repeatable?`],
    answers: [`Fitting on all data leaks information about the test set into training.`, `A model cannot compare 100 USD and 100 INR as the same number.`, `They became missing values, which I counted and handled instead of dropping silently.`, `Put the steps in a pipeline so the same code runs on new data.`],
  }),
  "ml-feature-engineering": (c, r) => ({
    title: `Feature pipeline for ${c.target} prediction at ${c.company}`,
    scenario: `${c.requester} wants a reusable feature pipeline so the same transformations run in training and in production.`,
    objective: [`Build a scikit-learn Pipeline with a ColumnTransformer`, `Handle numeric and categorical columns separately`, `Make sure unseen categories do not crash prediction`],
    code: `from sklearn.compose import ColumnTransformer\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.preprocessing import OneHotEncoder, StandardScaler\nfrom sklearn.impute import SimpleImputer\nnum = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])\ncat = OneHotEncoder(handle_unknown="ignore")\npre = ColumnTransformer([("num", num, num_cols), ("cat", cat, cat_cols)])\nmodel = Pipeline([("pre", pre), ("clf", clf)])`,
    checks: [`Numeric and categorical columns handled separately`, `Median imputation inside the pipeline`, `Unknown categories ignored at prediction`, `One object holds preprocessing and model`],
    strengths: ["Kept preprocessing and model in one pipeline object"],
    improvements: ["Add a test that a brand-new category does not break prediction"],
    questions: [`Why put preprocessing inside the pipeline?`, `What does handle_unknown do?`, `Why median instead of mean for imputing?`, `How would this be used in production?`],
    answers: [`So training and serving cannot drift apart: one object does both.`, `A category never seen in training becomes all zeros instead of an error.`, `The median is not pulled by a few very large values.`, `Save the fitted pipeline and load the same object in the serving code.`],
  }),
  "model-training": (c, r) => {
    const epochs = 12 + Math.round(r() * 18);
    return {
      title: `Train and track a ${c.target} classifier`,
      scenario: `${c.requester} wants a trained model with a repeatable setup and a clear record of how it was trained.`,
      objective: [`Fix the random seed`, `Use early stopping on a validation set`, `Save the best model and its metrics`],
      code: `import torch, random, numpy as np\nrandom.seed(7); np.random.seed(7); torch.manual_seed(7)\nbest, wait = 1e9, 0\nfor epoch in range(${epochs}):\n    train_one_epoch(model, train_dl)\n    v = evaluate(model, val_dl)\n    if v < best: best, wait = v, 0; torch.save(model.state_dict(), "best.pt")\n    else:\n        wait += 1\n        if wait == 4: break`,
      checks: [`Seeds fixed for repeatability`, `Early stopping watches validation loss`, `Best weights saved, not the last`, `Metrics recorded with the run`],
      strengths: ["Saved the best weights instead of the last epoch"],
      improvements: ["Record the learning rate and batch size next to the metrics"],
      questions: [`Why fix the random seed?`, `What does early stopping protect against?`, `Why save the best weights?`, `What else would you record for each run?`],
      answers: [`So someone else can rerun it and get the same result.`, `Overfitting: validation loss starts rising while training loss keeps falling.`, `The last epoch may be after the model started overfitting.`, `Learning rate, batch size, data version and the code version.`],
    };
  },
  evaluation: (c, r) => {
    const f1 = 0.66 + r() * 0.16;
    return {
      title: `Evaluate the ${c.target} model beyond accuracy`,
      scenario: `${c.company}'s ${c.target} data is imbalanced, so ${c.requester} does not trust the 94% accuracy the first model reports.`,
      objective: [`Show why accuracy is misleading here`, `Report precision, recall and F1 per class`, `Add a confusion matrix`],
      code: `from sklearn.metrics import classification_report, confusion_matrix\nprint("majority-class accuracy", round(1 - yte.mean(), 3))\nprint(classification_report(yte, pred, digits=3))\nprint(confusion_matrix(yte, pred))  # F1 ${f1.toFixed(2)}`,
      checks: [`Majority-class baseline shown`, `Per-class precision, recall and F1 (F1 ${f1.toFixed(2)})`, `Confusion matrix included`, `Conclusion refers to the minority class`],
      strengths: ["Showed the majority-class baseline to explain why accuracy misleads"],
      improvements: ["Add a calibration check before the scores are used as probabilities"],
      questions: [`Why is 94% accuracy not good news here?`, `What does F1 combine?`, `What does the confusion matrix show that a score cannot?`, `What would you check next?`],
      answers: [`Predicting the majority class every time would already score about that.`, `Precision and recall in one number, so a model cannot hide a weak side.`, `Which kind of mistake it makes, not just how many.`, `Whether the predicted probabilities are calibrated.`],
    };
  },
  "training-hygiene": (c, r) => ({
    title: `Find the leak in the ${c.target} training script`,
    scenario: `${c.requester}'s model scores 0.99 AUC in testing and 0.71 in production. ${c.company} suspects the training script.`,
    objective: [`Find where information from the test set reaches training`, `Fix the script`, `Say what score you now expect`],
    code: `# before: scaler = StandardScaler().fit(X)   <- fitted on all rows\nXtr, Xte, ytr, yte = train_test_split(X, y, test_size=.2, random_state=7)\nscaler = StandardScaler().fit(Xtr)\nXtr, Xte = scaler.transform(Xtr), scaler.transform(Xte)\n# also removed 'resolution_code': it is only known after the outcome`,
    checks: [`Scaler fitted on the training split only`, `Post-outcome column removed`, `Split happens before any fitting`, `Expected score is realistic (about 0.72)`],
    strengths: ["Found a second leak (a column only known after the outcome) beyond the scaler"],
    improvements: ["Add a check in the pipeline that fails when a feature is derived from the label"],
    questions: [`How did you spot the leak?`, `Why did the score drop after the fix?`, `What is the second leak?`, `How would you stop this reaching production again?`],
    answers: [`A 0.99 AUC on real-world data is a warning sign by itself.`, `The earlier score was inflated; the new one is what the model really can do.`, `resolution_code is only recorded after the outcome, so it gives the answer away.`, `Add a test and a code review step for every new feature.`],
  }),
  "error-analysis": (c, r) => ({
    title: `Error analysis on the ${c.target} model`,
    scenario: `${c.requester} wants to know where the ${c.target} model fails before deciding what data to collect next.`,
    objective: [`Group the errors by segment`, `Find the segment with the worst recall`, `Propose one data or feature change`],
    code: `errs = test.assign(pred=pred, wrong=(pred != yte))\nby_seg = errs.groupby("segment")["wrong"].agg(["mean", "size"]).sort_values("mean", ascending=False)\nprint(by_seg.head(3))\nprint(errs[errs.segment == by_seg.index[0]].sample(5, random_state=1)[["features_summary", "label", "pred"]])`,
    checks: [`Errors grouped by segment`, `Worst segment named with its size`, `Examples inspected by hand`, `One concrete follow-up proposed`],
    strengths: ["Looked at actual wrong examples, not only the numbers"],
    improvements: [`Weigh the error rate by how many ${c.unit} each segment has`],
    questions: [`Why group errors by segment?`, `Why read examples by hand?`, `What would you do about the worst segment?`, `When is more data not the answer?`],
    answers: [`An overall score hides a weak group.`, `Patterns in the wrong cases suggest a missing feature or a labelling issue.`, `Collect more examples for it or add a feature that describes it.`, `When the labels are noisy: more noisy data does not help.`],
  }),
  "model-deployment": (c, r) => ({
    title: `Serve the ${c.target} model behind an API`,
    scenario: `${c.company} needs the model available to the application as a small web service with input checks.`,
    objective: [`Load the saved pipeline once at startup`, `Validate the request body`, `Return the score and the model version`],
    code: `from fastapi import FastAPI\nfrom pydantic import BaseModel, Field\nimport joblib\napp = FastAPI()\nmodel = joblib.load("model-v3.joblib")\nclass Row(BaseModel):\n    tenure: int = Field(ge=0)\n    amount: float = Field(ge=0)\n    segment: str\n@app.post("/score")\ndef score(row: Row):\n    p = float(model.predict_proba([[row.tenure, row.amount, row.segment]])[0][1])\n    return {"score": round(p, 4), "model": "v3"}`,
    checks: [`Model loaded once, not per request`, `Input validated with a schema`, `Response includes the model version`, `Invalid input returns a clear error`],
    strengths: ["Validated inputs and returned the model version"],
    improvements: ["Add a health endpoint and request logging"],
    questions: [`Why load the model at startup?`, `Why validate the input?`, `Why return the model version?`, `What would you monitor after launch?`],
    answers: [`Loading per request would be slow and wasteful.`, `Bad input should fail with a clear message, not a wrong prediction.`, `So any score can be traced to the model that made it.`, `Latency, errors and whether the input data starts to change.`],
  }),
  "drift-monitoring": (c, r) => {
    const psi = 0.18 + r() * 0.2;
    return {
      title: `Detect data drift in the ${c.target} model inputs`,
      scenario: `${c.company}'s ${c.target} model has been live for 3 months and ${c.requester} suspects its inputs have shifted.`,
      objective: [`Compute PSI for the main features`, `Flag the features above the alert level`, `Recommend whether to retrain`],
      code: `def psi(a, b, bins=10):\n    q = np.quantile(a, np.linspace(0, 1, bins + 1)); q[0], q[-1] = -np.inf, np.inf\n    pa = np.histogram(a, q)[0] / len(a); pb = np.histogram(b, q)[0] / len(b)\n    pa, pb = np.clip(pa, 1e-4, None), np.clip(pb, 1e-4, None)\n    return float(((pb - pa) * np.log(pb / pa)).sum())\nprint({c: round(psi(train[c], live[c]), 2) for c in num_cols})  # amount ${psi.toFixed(2)}`,
      checks: [`PSI computed against the training bins`, `Alert level stated (0.2)`, `Drifting feature named (amount ${psi.toFixed(2)})`, `Retraining recommendation justified`],
      strengths: ["Used the training distribution as the reference for the bins"],
      improvements: ["Also watch the prediction distribution, not only the inputs"],
      questions: [`What does PSI measure?`, `Why use training bins?`, `Does drift always mean retrain?`, `What else would you watch?`],
      answers: [`How much a feature's distribution moved from the training data.`, `So both samples are compared on the same scale.`, `No. If performance holds, I would keep watching; if it drops, retrain.`, `The prediction scores and, when labels arrive, the real accuracy.`],
    };
  },
  "experiment-tracking": (c, r) => ({
    title: `Track experiments for the ${c.target} model`,
    scenario: `${c.requester}'s team keeps results in notebooks and cannot reproduce last month's best run.`,
    objective: [`Log parameters and metrics for each run`, `Store the model artifact with the run`, `Compare the last three runs`],
    code: `import mlflow\nmlflow.set_experiment("${c.target}-model")\nfor lr, depth in [(.1, 3), (.05, 4), (.03, 5)]:\n    with mlflow.start_run():\n        m = GradientBoostingClassifier(learning_rate=lr, max_depth=depth).fit(Xtr, ytr)\n        mlflow.log_params({"lr": lr, "depth": depth})\n        mlflow.log_metric("val_auc", roc_auc_score(yva, m.predict_proba(Xva)[:, 1]))\n        mlflow.sklearn.log_model(m, "model")`,
    checks: [`Parameters logged per run`, `Validation metric logged`, `Model stored with the run`, `Runs compared side by side`],
    strengths: ["Logged the model artifact with the run so it can be reloaded"],
    improvements: ["Also log the data version"],
    questions: [`Why log parameters and metrics together?`, `Why store the artifact?`, `What could make a run impossible to reproduce?`, `How would you choose the winning run?`],
    answers: [`A metric without its settings cannot be repeated.`, `So the exact model can be loaded again.`, `A changed dataset or a different code version.`, `Best validation metric, then check it holds on the untouched test set.`],
  }),
  "neural-networks": (c, r) => ({
    title: `Small neural network for ${c.target}`,
    scenario: `${c.requester} wants to know whether a small neural network beats the gradient boosting model on ${c.company}'s data.`,
    objective: [`Build a 2-layer network with dropout`, `Train it with a validation split`, `Compare it fairly with the tree model`],
    code: `net = nn.Sequential(nn.Linear(d, 64), nn.ReLU(), nn.Dropout(.2), nn.Linear(64, 32), nn.ReLU(), nn.Linear(32, 1))\nopt = torch.optim.Adam(net.parameters(), lr=1e-3, weight_decay=1e-4)\nloss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(float(w)))\n# trained 25 epochs; same splits and metric as the tree model`,
    checks: [`Dropout used to limit overfitting`, `Class imbalance handled with pos_weight`, `Same split and metric as the baseline`, `Honest comparison reported`],
    strengths: ["Used the same split and metric as the tree model so the comparison is fair"],
    improvements: ["Try one more learning rate before concluding"],
    questions: [`Why dropout?`, `What does pos_weight do?`, `Why compare on the same split?`, `Would you choose the network?`],
    answers: [`It randomly switches units off so the network cannot rely on one path.`, `It makes mistakes on the rare class cost more.`, `Otherwise any difference could come from the data, not the model.`, `Only if it clearly wins; a simpler model is easier to run and explain.`],
  }),
  "mle-python": (c, r) => ({
    title: `Vectorise the scoring code for ${c.company}`,
    scenario: `${c.requester}'s scoring job takes 40 minutes because it loops over every row in Python.`,
    objective: [`Replace the loop with NumPy operations`, `Keep the output identical`, `Show the speed-up`],
    code: `# before: for i in range(len(df)): out[i] = w1*df.a[i] + w2*np.log1p(df.b[i])\nout = w1 * df["a"].to_numpy() + w2 * np.log1p(df["b"].to_numpy())\nassert np.allclose(out, old_out)\nprint(timeit.timeit(lambda: f(df), number=3))  # 2.1s vs 38s`,
    checks: [`Loop replaced by array operations`, `Output verified equal to the old code`, `Timing measured, not assumed`, `No intermediate copies of the full table`],
    strengths: ["Proved the new code gives the same output before trusting the speed-up"],
    improvements: ["Process very large files in chunks"],
    questions: [`Why is the vectorised version faster?`, `How did you know the output was unchanged?`, `When does vectorising not help?`, `How would you handle a file larger than memory?`],
    answers: [`The loop runs in Python one row at a time; NumPy does it in compiled code across the whole array.`, `I compared the two outputs with allclose.`, `When the work per row cannot be expressed as array operations.`, `Read and score it in chunks.`],
  }),
  "mlops-config": (c, r) => ({
    title: `Training job configuration for ${c.company}`,
    scenario: `${c.requester} wants the weekly training job described as configuration, with no hard-coded paths or secrets.`,
    objective: [`Move paths and parameters into a config file`, `Read secrets from the environment`, `Fail early with a clear message when something is missing`],
    code: `import os, yaml\ncfg = yaml.safe_load(open("train.yaml"))\nbucket = os.environ.get("DATA_BUCKET")\nif not bucket:\n    raise SystemExit("DATA_BUCKET is not set")\nparams = {"lr": cfg["lr"], "epochs": cfg["epochs"], "seed": cfg.get("seed", 7)}`,
    checks: [`Parameters read from a config file`, `Secret read from the environment`, `Missing value stops the job with a clear message`, `No credentials in the repository`],
    strengths: ["Failed early with a clear message instead of halfway through the job"],
    improvements: ["Validate the config values (ranges and types) when it loads"],
    questions: [`Why keep parameters in a config file?`, `Why read the bucket from the environment?`, `Why fail early?`, `How would you keep the config versioned?`],
    answers: [`Changing a setting should not need a code change.`, `Credentials and locations must not be committed to the repository.`, `A job that dies after two hours on a missing value wastes time and money.`, `Keep it in the repository next to the code and tag it with each run.`],
  }),
};

const DS_AREAS = ["exploratory-analysis", "feature-engineering", "model-building", "model-evaluation", "experiment-design", "data-storytelling"];
const ML_AREAS = ["data-preparation", "ml-feature-engineering", "model-training", "evaluation", "training-hygiene", "error-analysis", "model-deployment", "drift-monitoring", "experiment-tracking", "neural-networks", "mle-python", "mlops-config"];

const DIFFICULTY_CYCLE: Difficulty[] = ["easy", "easy", "medium", "easy", "medium", "medium", "hard", "medium", "hard", "easy", "medium", "hard"];
const FAIL_NOTES = [
  "Two of four checks did not pass: the threshold was left at the default and the result was not explained.",
  "The submission ran but a check on leakage failed, so the ticket did not pass.",
  "Not every check passed: the split was not stratified and the score was reported on the training data.",
];

/**
 * `count` tickets for one student, oldest first. Roughly one in five is a miss. Difficulty rises with time, as a student who is improving would see.
 */
export function buildTasks(slug: string, roleKey: TaskSpec["roleKey"], count: number): TaskSpec[] {
  const areas = roleKey === "data-scientist" ? DS_AREAS : ML_AREAS;
  const rng = rngFor("arena-plan", slug);
  const failEvery = 5;
  const tasks: TaskSpec[] = [];
  for (let i = 0; i < count; i++) {
    const area = areas[i % areas.length];
    const kase = CASES[(i * 3 + (slug.length % 5)) % CASES.length];
    const r = SEEDS(`${slug}:${area}`, i);
    const b = AREA_BUILDERS[area](kase, r, i);
    const difficulty = DIFFICULTY_CYCLE[Math.min(DIFFICULTY_CYCLE.length - 1, Math.floor((i / count) * DIFFICULTY_CYCLE.length) + (i % 2))];
    const failed = i % failEvery === 3;
    const failedCheck = Math.floor(r() * b.checks.length);
    const checks = b.checks.map((label, k) => ({ label, passed: failed ? !(k === failedCheck || k === (failedCheck + 1) % b.checks.length) : true }));
    const score = failed ? 0 : Math.round(66 + rng() * 26);
    tasks.push({
      roleKey, areaKey: area, title: b.title, company: kase.company, requester: kase.requester, difficulty, toolType: "ml_workspace",
      scenario: b.scenario, objective: b.objective, code: b.code, checks, passed: !failed,
      message: failed ? FAIL_NOTES[i % FAIL_NOTES.length] : "Passed automated checks.",
      daysAgo: Math.round((count - i) * (78 / count)) + 2, minutes: 18 + Math.round(r() * 34),
      interview: { score, passed: !failed, questions: b.questions, answers: b.answers, strengths: b.strengths, improvements: b.improvements, notes: b.questions.map((_, k) => (k === 0 ? "Clear and specific." : k === 1 ? "Good reasoning with an example." : "Correct, could be more precise.")) },
    });
  }
  return tasks;
}
