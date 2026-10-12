import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ONBOARDING_PATHS } from "./paths";

const read = (f: string) => readFileSync(f, "utf8");

describe("path selector", () => {
  it("has exactly the four cards with the specified copy", () => {
    expect(ONBOARDING_PATHS.map((p) => [p.id, p.tagline])).toEqual([
      ["student", "Build your evidence-backed career profile."],
      ["professional", "Turn your work into verified, evidence-backed capability."],
      ["executive", "Build an evidence-backed leadership and professional profile."],
      ["organisation", "Connect, assess, develop, and understand your people."],
    ]);
    expect(ONBOARDING_PATHS.find((p) => p.id === "executive")?.subtext).toBe("Startup Founders, CEOs, Directors and other leaders");
    expect(ONBOARDING_PATHS.filter((p) => p.comingSoon).map((p) => p.id)).toEqual(["professional", "executive"]);
  });

  it("every card routes to an existing page; Student goes to the unchanged /signup", () => {
    expect(ONBOARDING_PATHS.find((p) => p.id === "student")?.href).toBe("/signup");
    for (const p of ONBOARDING_PATHS) {
      const dir = p.href === "/signup" ? "app/signup" : `app${p.href}`;
      expect(existsSync(`${dir}/page.tsx`), p.href).toBe(true);
    }
  });

  it("Professional/Executive pages only join an early-access list: no account, no direct database access in the browser", () => {
    for (const f of ["app/get-started/professional/page.tsx", "app/get-started/executive/page.tsx", "components/onboarding/WaitlistPage.tsx"]) {
      expect(read(f), f).not.toMatch(/supabase|localStorage|auth\.signUp/);
    }
    const form = read("components/onboarding/WaitlistForm.tsx");
    expect(form).toContain('fetch("/api/waitlist"');
    expect(form).not.toMatch(/supabase|type="password"|type="file"/);
  });

  it("the waitlist route accepts only the two coming-soon paths and the table is private", () => {
    const route = read("app/api/waitlist/route.ts");
    expect(route).toMatch(/z\.enum\(\["professional", "executive"\]\)/);
    expect(route).toContain(".strict()");
    const sql = read("supabase/migrations/097_path_waitlist.sql");
    expect(sql).toMatch(/alter table public\.path_waitlist enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.path_waitlist from anon, authenticated/i);
    expect(sql).not.toMatch(/create policy/i);
  });

  it("student signup form is untouched by this task (still student-only metadata)", () => {
    const src = read("components/login/auth.ts");
    expect(src).toContain('role: "student"');
    expect(read("components/login/SignupForm.tsx")).toContain("validateProgramYears");
  });
});
