# Org Onboarding Progress
**Current phase:** Phase 6 verification (see below)
## Decisions
- Approval = operator script `scripts/org-approvals.mjs` (list/approve). Real next migration = 036 (+037 follow-up); 029 untouched.
- `docs/CAPABILIO_ORGANISATION_PATH.md` is missing from the repo.
- New enum roles `tpo`, `company_admin`; pending-by-default via inverted `role_requires_verification`.
## Done / verified
- P1 audit, P2 design (docs/org-onboarding-audit.md). P3 selector + stubs + CTAs. P4 org form, `/api/org/signup`, `create_org_signup`, approval script, pending login state. P5 tests: lib/onboarding, lib/org (unit + live, 18 tests).
- Prod cleanup verified: 0 leftover test users/institutions.
## Remaining
- Manual browser walkthrough (email confirmation is rate-limited; signUp email path unit-tested only).
