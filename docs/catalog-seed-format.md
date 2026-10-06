# Catalog seed format

The roadmap only ever recommends what is configured in the catalogs. They start empty (apart from two certifications carried over from
`skill_area_resources`), and an operator fills them with `scripts/seed-catalogs.mjs`:

```
node --env-file=.env.local scripts/seed-catalogs.mjs path/to/catalogs.json --dry-run   # validate, write nothing
node --env-file=.env.local scripts/seed-catalogs.mjs path/to/catalogs.json
```

The whole file is validated first. An unknown or inactive skill key, or an unknown career key, stops the run before anything is written, and
every problem is listed. Re-running is safe: certifications and learning resources are matched by provider + name/title, projects by title + source.

**Nothing is invented for you** — only put in resources you have verified (names, providers, URLs, levels). Leave out any optional field you don't know;
an unstated difficulty, cost or duration stays empty rather than guessed.

```jsonc
{
  "certifications": [
    {
      "name": "…", "provider": "…",
      "difficulty": "BEGINNER",                 // optional: BEGINNER | INTERMEDIATE | ADVANCED
      "url": "https://…", "cost": "…", "duration": "…", "eligibility": "…",   // all optional
      "skills": ["SKILL_SQL"],                  // keys of ACTIVE skills (see the skills table)
      "careers": [{ "career": "data-analyst", "relevance": "RECOMMENDED" }]   // REQUIRED | RECOMMENDED | OPTIONAL — stated by you, never inferred
    }
  ],
  "learning": [
    {
      "title": "…", "provider": "…", "url": "https://…",
      "levelFrom": 0, "levelTo": 60,            // the 0–100 capability range it takes a learner across
      "estimatedHours": 12, "prerequisites": ["…"],   // optional
      "skills": ["SKILL_SQL"]
    }
  ],
  "projects": [
    {
      "title": "…", "description": "…", "difficulty": "BEGINNER",
      "expectedEvidence": ["a published dashboard link"],   // optional
      "source": "CAPABILIO",                    // CAPABILIO | MENTOR  (COLLEGE projects belong to one college; AI_GENERATED are per-student recommendations — neither is seeded)
      "status": "ACTIVE",                       // optional, default ACTIVE
      "skills": ["SKILL_SQL"]
    }
  ]
}
```

A recommendation labelled REQUIRED / RECOMMENDED / OPTIONAL for a career comes only from the `relevance` you set here.
Skill keys and career keys: `select key, name from skills where status = 'active'` and `select key, name from careers`.
