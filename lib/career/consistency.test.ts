import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildDirection, shouldShowGoalPrompt } from "./direction";
import { assessmentModeFor } from "@/lib/assessment/mode";
import { isCareerDirectionWindow } from "./trigger";
import { rejectSectionOutsideMode } from "@/lib/assessment/guard";
import { listOpenOpportunities } from "@/lib/launchpad/opportunities";

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".claude", ".agents", "graft", "graphify-out"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d)));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("onboarding surface", () => {
  it("has no Google sign-in/sign-up anywhere in the app", () => {
    const offenders = SOURCES.filter((f) => /signInWithGoogle|GoogleIcon|provider:\s*["']google["']|Continue with Google/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("every Get Started CTA goes to the /get-started path selector, not '#'", () => {
    for (const f of ["components/Navbar.tsx", "components/Hero.tsx", "components/FinalCTA.tsx"]) {
      const src = read(f);
      const around = [...src.matchAll(/([^\n]*\n){0,3}[^\n]*Get Started[^\n]*/g)].map((m) => m[0]).join("\n");
      expect(around, f).toContain("/get-started");
      expect(around, f).not.toMatch(/href="#"/);
    }
  });
  it("signup captures start/end year and no longer the semester-label select", () => {
    const src = read("components/login/SignupForm.tsx");
    expect(src).toContain('id="start-year"');
    expect(src).toContain('id="end-year"');
    expect(src).not.toContain("YEAR_OPTIONS");
  });
});

describe("the 3-2 trigger has exactly one implementation", () => {
  it("no source file computes end-year arithmetic outside the shared utility", () => {
    const allowed = new Set(["lib/career/trigger.ts", "lib/career/years.ts"]); // years.ts: program length, not the trigger
    const offenders = SOURCES.map((f) => f.slice(ROOT.length + 1)).filter(
      (rel) => !allowed.has(rel) && /end_?[Yy]ear\s*-\s*|-\s*(?:[a-z]+\.)?end_?[Yy]ear|getFullYear\(\)\s*-\s*[a-z_.]*end/.test(read(rel))
    );
    expect(offenders).toEqual([]);
  });
  it("the old semester-based gate is gone", () => {
    expect(SOURCES.filter((f) => /isStageUnlocked|UNLOCK_STAGE_KEY/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});

describe("assessment gating, goal prompt and Launchpad agree for the same student", () => {
  it("across every end_year/now combination", () => {
    for (let endYear = 2026; endYear <= 2032; endYear++) {
      for (let year = 2025; year <= 2033; year++) {
        const now = new Date(year, 5, 1);
        const d = buildDirection(
          { id: "m", start_year: endYear - 4, end_year: endYear, year_confirmed_at: null, year_override: null, goal_state: null, goal_state_updated_at: null,
            goal_state_prompted_at: null, higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null },
          7,
          now
        );
        const inWindow = isCareerDirectionWindow(endYear, now);
        expect(d.inDirectionWindow).toBe(inWindow); // Launchpad / Interview / nav flag
        expect(assessmentModeFor(d) === "light").toBe(inWindow); // assessment gating
        expect(shouldShowGoalPrompt(d, now)).toBe(inWindow); // unset goal + never prompted => prompt iff in window
      }
    }
  });
});

describe("assessment section guard (server-decided mode)", () => {
  const supabaseFor = (endYear: number): SupabaseClient<Database> => {
    const row = { id: "m", status: "active", branch: "CSE", created_at: "2026-01-01", start_year: endYear - 4, end_year: endYear, year_confirmed_at: null, year_override: null,
      goal_state: null, goal_state_updated_at: null, goal_state_prompted_at: null, higher_studies_checkin_at: null, active_role_key: null, portfolio_prompt_seen_at: null, institutions: { academic_start_month: 7 } };
    const q = { select: () => q, eq: () => q, order: async () => ({ data: [row], error: null }) };
    return { from: () => q } as unknown as SupabaseClient<Database>;
  };
  const thisYear = new Date().getFullYear();
  it("a final-years student is blocked from full-assessment sections but not their own", async () => {
    const s = supabaseFor(thisYear + 1);
    expect((await rejectSectionOutsideMode(s, "u", "quantitative_aptitude"))?.status).toBe(403);
    expect(await rejectSectionOutsideMode(s, "u", "verbal_communication")).toBeNull();
    expect(await rejectSectionOutsideMode(s, "u", "career_interests")).toBeNull();
  });
  it("an earlier-year student can take every section", async () => {
    const s = supabaseFor(thisYear + 3);
    expect(await rejectSectionOutsideMode(s, "u", "quantitative_aptitude")).toBeNull();
  });
});

describe("Launchpad never fabricates", () => {
  it("an empty opportunities table yields an empty list", async () => {
    const q = { select: () => q, order: async () => ({ data: [], error: null }) };
    const s = { from: () => q } as unknown as SupabaseClient<Database>;
    expect(await listOpenOpportunities(s)).toEqual([]);
  });
  it("the mock listings module and its sample-roles copy are gone", () => {
    expect(SOURCES.filter((f) => /MOCK_OPPORTUNITIES|sample roles/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
