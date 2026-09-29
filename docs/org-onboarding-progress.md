# Org Onboarding Progress
**Current phase:** COMPLETE
## Decisions
- Approval = operator script `scripts/org-approvals.mjs` (list/approve). Real next migration = 036 (+037 follow-up); 029 untouched.
- `docs/CAPABILIO_ORGANISATION_PATH.md` is missing from the repo.
- New enum roles `tpo`, `company_admin`; pending-by-default via inverted `role_requires_verification`.
## Done / verified
- P1 audit, P2 design (docs/org-onboarding-audit.md). P3 selector + stubs + CTAs. P4 org form, `/api/org/signup`, `create_org_signup`, approval script, pending login state. P5 tests: lib/onboarding, lib/org (unit + live, 18 tests).
- Prod cleanup verified: 0 leftover test users/institutions.
- P6: tsc clean; eslint clean on touched files (1 pre-existing warning); vitest 353/353; live Job-Track regression (lib/security, lib/career) 7/7; live org tests 10/10; `next build` exit 0 with /get-started, /get-started/{professional,executive,organisation}.
## Remaining / not done
- No browser click-through: signUp confirmation emails are rate-limited on the project mailer, so signup→approval→login was verified at DB/API level (live tests), not through the UI.
