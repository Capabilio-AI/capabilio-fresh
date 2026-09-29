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

  it("Professional/Executive stubs take no input and persist nothing", () => {
    for (const f of ["app/get-started/professional/page.tsx", "app/get-started/executive/page.tsx", "components/onboarding/ComingSoon.tsx"]) {
      expect(read(f), f).not.toMatch(/<form|<input|<textarea|type="file"|supabase|fetch\(|localStorage|"use client"/);
    }
  });

  it("student signup form is untouched by this task (still student-only metadata)", () => {
    const src = read("components/login/auth.ts");
    expect(src).toContain('role: "student"');
    expect(read("components/login/SignupForm.tsx")).toContain("validateProgramYears");
  });
});
