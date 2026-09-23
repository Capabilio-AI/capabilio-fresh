# Graph Report - Capabilio-fresh  (2026-09-22)

## Corpus Check
- Corpus is ~16,228 words - fits in a single context window. You may not need a graph.

## Summary
- 250 nodes · 397 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.57)
- Token cost: 76,536 input · 0 output

## Community Hubs (Navigation)
- Landing Page Sections
- Supabase Auth Logic
- TypeScript Config
- Supabase Client & Middleware
- Signup / Reset Password UI
- Dev Dependencies
- Runtime Dependencies
- Login & Signup Pages
- Hero Section
- README & Brand Docs
- AGENTS.md Breaking-Changes Notice
- Root Layout
- Next.js Config
- PostCSS Config

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Reveal()` - 13 edges
3. `createClient()` - 13 edges
4. `SectionLabel()` - 12 edges
5. `include` - 7 edges
6. `AuthCard()` - 6 edges
7. `RoleId` - 5 edges
8. `getRole()` - 5 edges
9. `Enums` - 5 edges
10. `CardChrome()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Capabilio "C." Brand Mark` --conceptually_related_to--> `Capabilio Next.js Project (README)`  [INFERRED]
  public/logo-mark.jpg → README.md
- `CollegeAutocomplete()` --calls--> `createClient()`  [EXTRACTED]
  components/login/CollegeAutocomplete.tsx → lib/supabase/client.ts
- `ResetPasswordForm()` --calls--> `createClient()`  [EXTRACTED]
  components/login/ResetPasswordForm.tsx → lib/supabase/client.ts
- `signUp()` --calls--> `createClient()`  [EXTRACTED]
  components/login/auth.ts → lib/supabase/client.ts
- `getBranches()` --calls--> `createClient()`  [EXTRACTED]
  components/login/directory.ts → lib/supabase/client.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Project Root Documentation Set** — claude_agents_import, agents_nextjs_breaking_changes, readme_nextjs_project [INFERRED 0.75]

## Communities (14 total, 3 thin omitted)

### Community 0 - "Landing Page Sections"
Cohesion: 0.07
Nodes (33): Arena(), CONTRIBUTIONS, BAR_COLOR, BENCHMARKS, CareerPath(), TRACKS, Curriculum(), UNITS (+25 more)

### Community 1 - "Supabase Auth Logic"
Cohesion: 0.10
Nodes (30): AuthOutcome, Institution, portalFor(), requestPasswordReset(), resendVerificationEmail(), SELF_SERVE_ROLES, signIn(), signInWithGoogle() (+22 more)

### Community 2 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 3 - "Supabase Client & Middleware"
Cohesion: 0.13
Nodes (16): GET(), SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, updateSession(), createClient(), CompositeTypes, Constants, Database (+8 more)

### Community 4 - "Signup / Reset Password UI"
Cohesion: 0.13
Nodes (15): metadata, signUp(), CardChrome(), CardChromeProps, CollegeAutocomplete(), CollegeAutocompleteProps, CollegeMatch, BranchOption (+7 more)

### Community 5 - "Dev Dependencies"
Cohesion: 0.10
Nodes (20): devDependencies, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript, name (+12 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (19): clsx, framer-motion, lucide-react, next, dependencies, clsx, framer-motion, lucide-react (+11 more)

### Community 7 - "Login & Signup Pages"
Cohesion: 0.19
Nodes (7): metadata, metadata, AuthLayout(), BrandPanel(), JOURNEY, SIGNALS, LoginScreen()

### Community 8 - "Hero Section"
Cohesion: 0.22
Nodes (7): BAR_COLOR, Hero(), PIPELINE, SKILLS, STATUS_COLOR, STATUS_ICON, SecondaryButton()

### Community 9 - "README & Brand Docs"
Cohesion: 0.50
Nodes (5): Capabilio "C." Brand Mark, create-next-app, next/font + Geist Font Optimization, Capabilio Next.js Project (README), Vercel Deployment Platform

### Community 10 - "AGENTS.md Breaking-Changes Notice"
Cohesion: 0.50
Nodes (4): generate-agent-files.js, node_modules/next/dist/docs/ (Next.js Agent Docs), Next.js Breaking Changes Notice, CLAUDE.md Root Config

## Knowledge Gaps
- **100 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `CONTRIBUTIONS` (+95 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Badge()` connect `Landing Page Sections` to `Hero Section`, `Signup / Reset Password UI`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Dev Dependencies`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _100 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing Page Sections` be split into smaller, more focused modules?**
  _Cohesion score 0.07337526205450734 - nodes in this community are weakly interconnected._
- **Should `Supabase Auth Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.10256410256410256 - nodes in this community are weakly interconnected._
- **Should `TypeScript Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Supabase Client & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._