# Capabilio Professional Path: Ecosystem Design

Status: design, 2026-11-15. Nothing here is built beyond the signed-out preview (`/preview/professional`, `lib/professional/*`). Supersedes the "gap plan" in chat.

## 1. Thesis

LinkedIn shows who you are and whom you know. The Professional Path proves **what you have done, with whom, and what it was like to work there**, and lets you act on it (ask, vouch, refer, build, mentor, move) without being watched by your employer.

One sentence for the product: **a professional network where every claim has a witness.**

## 2. What the research says (and what it doesn't)

| Finding | Source | Design consequence |
|---|---|---|
| LinkedIn is shipping verified AI skills (partner-tool usage certificates), Connected Apps, a network feed, digital cards, private notes | [LinkedIn news](https://news.linkedin.com/2026/Verified_Skills), [TechCrunch](https://techcrunch.com/2026/01/28/linkedin-will-let-you-show-off-your-vibe-coding-chops-with-a-certificate) | Skill verification alone is no longer a moat. Our edge is verifying **tenure, collaboration and outcomes**, which a tool-usage badge cannot. |
| 72% of professionals question a role's legitimacy before applying; ghost jobs and fake recruiter profiles are a live trust problem; Texas is investigating | [Help Net Security](https://www.helpnetsecurity.com/2026/05/06/linkedin-job-scams-hit-hard/), [ERE](https://newsletter.ere.net/p/texas-takes-aim-at-linkedin-over-ghost-jobs) | Openings must carry proof of life: verified poster, recruiter reply rate, auto-expiry. |
| In India 45-70% of hiring is network-based (vs 20-35% in the US) | [IGC working paper](https://www.theigc.org/sites/default/files/2025-01/Fernando%20et%20al%20Working%20paper%20June%202022.pdf) | Referrals are the product, not a side feature. They need accountability on both sides. |
| Blind/Glassdoor are used to judge employers; Blind is verified-anonymous but has a bashing tone; Glassdoor pay data is disputed | [Blind](https://external.pi.gpi.aws.gartner.com/reviews/product/blind-for-business), [alternatives roundup](https://career.io/career-advice/professional-social-network-alternatives-for-linkedin) | Company truth should be structured (promise vs reality, minimum raters), not free-form venting. |
| Polywork (timeline) and Read.cv (portfolio) stayed niche; people keep LinkedIn alongside | [roundup](https://www.lemlist.com/blog/linkedin-alternatives) | A prettier profile does not win. Reasons to return weekly do: asks, referrals, squads, mentoring. |

Not found: any 2026 data on recruiter ghosting rates, and any independent evidence on how a private platform may use EPFO records. Treat both as open (section 10). The vendor figures above are marketing-grade; none are load-bearing for the design.

## 3. Principles (locked rules from earlier decisions, plus new ones)

1. Professionals get no assessments, Arena or roadmap. Evidence comes from work, not tests.
2. Verified tenure first: EPFO / work email / payslip tiers. Store employer, dates, result. Never wages.
3. No public vanity metrics. No follower counts, no public likes, no impressions. Show **usefulness receipts** instead.
4. A claim is only as strong as its witnesses. Witnesses must have been in a position to know.
5. Quiet by default. Nothing a current employer could see unless the member opts in.
6. Anonymous aggregates only above a minimum sample (5 raters for companies, 8 for salary).
7. Every ranking is explainable in one sentence to the person it affects.

## 4. The ecosystem: nine surfaces on one spine

The spine is the **Career Line** (verified tenure as the backbone, dashed for self-claimed). Everything else hangs off it.

### 4.1 Career Line (identity)
Metro-line career: each stop is an employer stay with a verification tier. Between stops, **work receipts** attach (4.2). Self-claimed stops stay dashed and cannot unlock tenure-gated features.

### 4.2 Overlap Vouching (the signature feature)
Only people whose **verified tenure overlapped yours at the same employer** can vouch for what you did there. The platform knows overlap because it verified both stays. Consequences:
- Vouches cannot come from friends outside the company, so they cannot be inflated by rings.
- A vouch is structured: *role in the work, scope, outcome, would work with again*, not a star rating.
- Weight rises with overlap months and with the voucher's own verified standing, and falls if the same pair vouches repeatedly.
- The vouched person approves what appears on their line; the voucher can withdraw. No employer IP is required, only the claim and the witness.

LinkedIn's recommendations are unverifiable prose from anyone. This is the single feature LinkedIn cannot copy cheaply, because it needs verified tenure on both sides.

### 4.3 Asks (knowledge exchange)
A member posts an **Ask** addressed to a role and minimum verified years ("a payments engineer with 5+ verified years"). Only matching members see it. Answers are rated useful by the asker; the answerer's usefulness receipt grows. Asks expire, resolve, and become searchable answered cases. No feed rewards outrage.

### 4.4 Referral Exchange
- Candidates request referrals into a specific opening; the referrer sees the candidate's Career Line, receipts and fit, not a résumé PDF.
- **Accountability both ways**: the referrer's referral-to-interview rate is visible to them privately and gates a "trusted referrer" mark; candidates see the company's real referral response time.
- Referrers can decline with a one-tap reason; candidates are never left silent (auto-close after N days with a notice).
- No fees, no payouts in v1 (avoids spam economics).

### 4.5 Launchpad (opportunities, honest)
Openings show: verified poster, recruiter reply rate, days since last human action, **Promise vs Reality** (4.7), and fit computed from verified evidence. Openings with no human action in 30 days expire. **Apply quietly** hides the application from the current employer's circle and recruiters from that company. Later kinds on the same matcher: freelance, advisory, research, hackathon, volunteer.

### 4.6 Squads (Build With Me)
Time-boxed project teams (2-12 weeks). A founder or lead posts a squad with required capabilities, expected hours and an end condition. Applicants are matched against verified evidence. At close, the squad produces a **contribution ledger**: each member's role, scope, evidence links, and peer-confirmed outcome. Squads that finish become receipts on everyone's Career Line, vouch-eligible for all members. Squads that fail close without penalty, but repeated abandonment is visible to the squad leaders who see applications.

### 4.7 Company Truth
Anonymous, verified-current-or-former ratings, hidden until 5 raters. **Promise vs Reality**: Day-30 check against what the opening promised, plus exit rating. Structured prompts (manager, growth, pay honesty, hours), not free text first. Free-text is moderated and shown only above the minimum sample, with re-identification checks (small teams, rare roles are merged or suppressed).

### 4.8 Mentoring
As decided: unlocks at 120 months verified employment, opt-in/out, free in v1, plan-limited seats, visible to students and recent graduates, ranked by Bayesian rating plus reliability after 3 rated sessions. Outcome link: a mentee can mark a goal met, which feeds the mentor's receipts. Merge with the existing Pulse mentor directory (`mentor_profiles`) rather than running two.

### 4.9 Next Move (career intelligence)
Not a roadmap of courses. Inputs: Career Line, receipts, vouches, target role. Outputs:
- **Missing evidence** for a target role (reuse `lib/roadmap-engine/gaps.ts`, fed from receipts instead of curriculum).
- **Reachable moves**: roles other people with similar lines actually moved to, with the time it took (aggregate, 8-sample minimum).
- **Offer comparison** with India new-regime take-home (built in `lib/professional/offer.ts`).
- **Who to ask**: people one step ahead on the path you want, via Asks or mentoring.

## 5. Trust and anti-gaming layer

| Threat | Control |
|---|---|
| Vouch rings / reciprocal vouching | Overlap-gated; per-pair cap; reciprocal pairs down-weighted; graph check for dense clusters |
| Fake employer stays | Tiered verification; self-claimed stops cannot vouch, rate or mentor |
| Fake recruiters / ghost jobs | Verified poster; reply-rate display; 30-day human-action expiry |
| Review bombing | Verified raters only; 5-rater floor; one rating per stay; outlier damping |
| De-anonymisation | Suppress small cells; no timestamps below week precision; delay publication |
| Employer surveillance | Quiet by default; employer-domain blocklist for Apply quietly; no activity indicators |
| Engagement bait | No public reaction counts; Asks ranked by resolution, not volume |
| Spam outreach | Addressed Asks only; recipients opt into categories; rate limits per tier |

## 6. Reputation without popularity

Per member, private to them and summarised publicly as small, explainable marks:
- **Verified stays** (tier, months)
- **Vouched work** (count, distinct vouchers, overlap-weighted)
- **Useful answers** (resolved Asks)
- **Delivered squads** (finished with ledger)
- **Reliable referrer** (response rate, outcomes)
- **Mentoring** (rated sessions)

No single score. Each mark carries "why you have this" text. Marks decay slowly so they reflect recent behaviour.

## 7. Cold start

Pure professional networks die empty. Seeding order:
1. **Graduates become professionals**: Capabilio's own students and alumni (`lib/graduate`, `lib/passport`) arrive with evidence already on the Career Line. This is the unfair advantage.
2. **Employer circles** form automatically once 5 verified members share an employer (also the 5-rater floor).
3. **Mentors first**: 120-month verified mentors serve students already on the platform, so supply has demand on day one.
4. Asks start inside employer and role circles, where answers are likely.

## 8. Metrics (replace followers and likes)

Verified stays added, vouches given and received (distinct, overlap-weighted), Asks resolved within 72 hours, referrals reaching interview, squads delivered, mentoring goals met, Promise-vs-Reality gap by company, median time from referral request to first human response. A network is healthy when these rise, not when time-on-site does.

## 9. Data model sketch (new tables; all RLS, all service-role writes for trust-bearing rows)

`pro_stays` (user, employer, start, end, tier, verified_at) · `pro_vouches` (voucher, subject, stay_id, role, scope, outcome, weight, status) · `pro_asks`, `pro_ask_answers` (resolved, useful) · `pro_referrals` (candidate, referrer, opening, status, reason, closed_at) · `pro_openings` (poster_verified, last_human_action_at, expires_at, kind) · `pro_squads`, `pro_squad_members`, `pro_squad_ledger` · `pro_company_ratings` (stay_id, dimensions, window) · `pro_visibility` (per-surface opt-ins, blocklist) · `pro_marks` (derived, recomputed). Wages are never stored.

## 10. Open risks and decisions (need an owner decision or legal input)

1. **EPFO use by a private platform.** No independent evidence found. Needs legal review under India's data-protection law (consent, purpose limitation, UAN handling) and a vendor decision before any integration. Fallback tiers (work email, payslip) work without it.
2. **Vouch weighting formula** and the per-pair cap are the main gaming surface; ship with logging and a manual review lane before automation.
3. **Anonymity floors** can leave small companies without ratings for a long time. Accept that, do not lower the floor.
4. **Moderation capacity**: Asks and Company Truth free text need a human lane (reuse `lib/pulse/moderation.ts`).
5. **Name collisions**: existing Pulse (students/graduates) and Professional Pulse must share one people graph (`lib/pulse/graph.ts`) without leaking student-only surfaces.

## 11. Build order (reuse first)

| Phase | Ship | Reuses |
|---|---|---|
| 0 | Persist stays and tiers; real `/professional` routes; nav config; remove the stage block on Launchpad | `lib/professional/tenure.ts`, `verify-match.ts`, `visibility.ts` |
| 1 | Overlap Vouching + Career Line receipts | `lib/evidence/record.ts`, `seal.ts` |
| 2 | Asks + employer/role Circles | `lib/pulse/communities.ts`, `ranked-feed.ts` |
| 3 | Referral Exchange + honest Openings | `lib/professional/launchpad.ts`, `lib/launchpad/match.ts` |
| 4 | Mentoring merged with the Pulse mentor directory | `lib/professional/slots.ts`, `lib/pulse/mentors.ts` |
| 5 | Company Truth | `lib/professional/ratings.ts` |
| 6 | Squads and contribution ledger | `lib/pulse/messages.ts`, `lib/capability/matrix.ts` |
| 7 | Next Move | `lib/roadmap-engine/gaps.ts`, `lib/professional/offer.ts` |

Phases 1-3 are the minimum that makes the network worth returning to; each phase ships a preview page first, as the current work did.
