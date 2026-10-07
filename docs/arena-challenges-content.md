# Arena challenges — authoring guide and content roadmap

## Pipeline
`spec (JSON)` → **import** (DRAFT) → **validate** (reference solution passes, blank fails) → **publish** (PUBLISHED, reviewer recorded) → students.
Editing a spec returns it to DRAFT and clears its validation; the database refuses to publish AI-generated content without a reviewer.

Authoring needs no deploy:
```
npm run arena:content -- templates                  # upsert workstation templates (content/arena/templates.json)
npm run arena:content -- validate content/arena/seed
npm run arena:content -- import content/arena/seed  # validates, then saves as DRAFT
npm run arena:content -- publish <spec-key>
npm run arena:content -- retire <spec-key>
npm run arena:content -- list
npm run arena:content -- grant-admin <email>        # Capabilio admin (platform_admins)
```
The same actions are available at `/admin/arena-challenges` (Capabilio admins only). Notebook references run on a local `python3`, so validate those with the CLI.

## Spec format (`lib/arena-content/spec.ts`)
Key fields: `key`, `track` (stream|domain), `title`, `difficulty`, `estMinutes`, `template` (a workstation template key), `ticketBrief` (markdown),
`skills` (canonical skill **names**), `careers` (career keys, domain) or `branches` (branch names as students record them, stream), `steps`, `checks`,
`hints`, `provenance` (required for seed content), `reference` (a solution that must pass) and optional `wrong` (one that must fail).

* Checks hold the expected answers in `config`. Only `config.public` reaches the browser (prompt, options, units, DOM assertions, notebook `variable`).
* `assets` is starter material the student sees (seed SQL, starter files, notebook cells, data files). Never put answers there.
* Which check types each workstation can collect is enforced (`RUNTIME_CHECKS` in `validate.ts`).
* A pass is **VERIFIED_AUTOMATED** only if every check is server-verifiable. `DOM_ASSERTION` / `TEST_RUN` run in the browser, so a pass is UNVERIFIED (locks the challenge, no ELO/points/evidence).

## Seed set (22 challenges, all validated; imported as DRAFT)
| Track | Target | Workstation | Challenges |
|---|---|---|---|
| Domain | Full-Stack Developer (front-end) | code editor + preview | accessible form, semantic structure (verified); product card with live DOM checks (UNVERIFIED practice) |
| Domain | Data Analyst | SQL console | 3 tickets on a synthetic order dataset |
| Domain | AI/ML Engineer | Python notebook (stdlib) | profile a dataset, least-squares fit, classifier metrics |
| Domain | Cloud Engineer (DevOps) | config editor | Dockerfile, Kubernetes Deployment, CI workflow |
| Stream | Civil, Mechanical, EEE, ECE, CSE/IT | worksheet + scenario questions | 2 each |

Provenance: all content is original; datasets are synthetic; formulas and facts are textbook-standard. Each spec records this in `provenance`.

### Known gaps
* **TERMINAL_VM** is not built, so DevOps tasks use a configuration editor graded on file contents. Real terminal tasks wait for a sandbox decision.
* **Taxonomy:** the canonical skills are CS-centric. Non-CS stream challenges are tagged `Problem Solving` (and `Computer Architecture` for digital logic) only because nothing closer exists. Add skills (Circuit Analysis, Thermodynamics, Structural Analysis, ...) through the taxonomy owner, then re-tag.
* There is no "Frontend Developer" or "DevOps" career: front-end maps to `full-stack-developer`, DevOps to `cloud-engineer`.
* Simulators are not embedded (no licence review done); calculation worksheets are used instead.

## Roadmap of remaining content
Roles: Data Scientist, Cybersecurity Analyst, Business Analyst, Product Manager, Product Designer, Software Engineer (back-end/API), plus a real terminal workstation for Linux, networking and security.
Streams: IT/AI&DS/CSBS-specific tracks, Chemical, Biotechnology, Instrumentation, Aerospace, Automobile, Mining, Textile, MBA/MCA.
Per item: author the spec, give it a reference and a wrong solution, `validate`, `import`, review, `publish`.
