import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The professional path owns its pages, components, tables and routes. It must not import from the student or graduate paths.
const ROOTS = ["lib/professional", "components/professional", "app/(app)/professional", "app/api/professional"];

// Student or graduate modules a professional file must never import.
const FORBIDDEN = [
  "@/lib/arena", "@/lib/roadmap", "@/lib/graduate/home", "@/lib/graduate/apply", "@/lib/graduate/focus", "@/lib/graduate/next-move", "@/lib/graduate/pipeline",
  "@/lib/dashboard", "@/lib/pulse", "@/lib/launchpad", "@/lib/career", "@/lib/assess/flow", "@/lib/assess/gate", "@/lib/assess/session",
  "@/components/dashboard", "@/components/pulse", "@/components/skillstudio", "@/components/graduate", "@/components/arena", "@/components/launchpad", "@/components/assess",
];

// The few shared pieces that are identity or plumbing, not path features.
const ALLOWED = ["@/lib/assess/http", "@/lib/assess/types", "@/lib/graduate/name-match", "@/lib/roadmap/extract/pdf", "@/lib/uploads/limits"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("professional path boundary", () => {
  it("imports nothing from the student or graduate paths", () => {
    const bad: string[] = [];
    expect(ROOTS.flatMap(files).length).toBeGreaterThan(20); // the scan really sees the professional code
    for (const root of ROOTS) {
      for (const file of files(root)) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(/from "(@\/[^"]+)"/g)) {
          const spec = m[1];
          if (ALLOWED.some((a) => spec === a || spec.startsWith(`${a}/`))) continue;
          if (FORBIDDEN.some((f) => spec === f || spec.startsWith(`${f}/`))) bad.push(`${file} imports ${spec}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("reads no student or graduate table", () => {
    const tables = ["graduate_resumes", "student_", "assess_", "arena_", "roadmap", "vault_items", "community_", "dm_", "stories"];
    const bad: string[] = [];
    for (const root of ROOTS) {
      for (const file of files(root)) {
        const src = readFileSync(file, "utf8");
        for (const t of tables) if (src.includes(`from("${t}`)) bad.push(`${file} reads ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
