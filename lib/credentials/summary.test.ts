import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { summarise } from "./summary";
import type { ModuleEvidenceEntry } from "./credential";

const m = (over: Partial<ModuleEvidenceEntry> = {}): ModuleEvidenceEntry => ({ k: "a", t: "A", p: "2026-11-01T00:00:00Z", aa: 1, pa: 2, sc: 9, st: 10, pl: "c", tp: 8, tn: 8, ch: "a".repeat(64), ...over });

describe("summarise", () => {
  it("adds up the evidence", () => {
    const s = summarise([m(), m({ k: "b", p: "2026-11-05T00:00:00Z", sc: 7, st: 10, tp: 6, tn: 8, aa: 2, pa: 1 })]);
    expect(s).toMatchObject({ modules: 2, testPct: 80, problems: 2, testsPassed: 14, testsTotal: 16, languages: ["c"], tries: 6, first: "2026-11-01T00:00:00Z", last: "2026-11-05T00:00:00Z" });
  });
  it("leaves out what was not recorded instead of counting it as zero", () => {
    const s = summarise([m(), m({ k: "b", sc: null, st: null, pl: null, tp: null, tn: null, ch: null })]);
    expect(s.testPct).toBe(90);
    expect(s.problems).toBe(1);
    expect(s.testsPassed).toBe(8);
    expect(s.testsTotal).toBe(8);
  });
  it("says null for a score when nothing was recorded", () => {
    expect(summarise([m({ sc: null, st: null })]).testPct).toBeNull();
    expect(summarise([]).testPct).toBeNull();
  });
});

describe("a certificate shows only its own evidence", () => {
  // the public certificate pages must not read the learner's passport, badges, profile or any other course
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) out.push(p); }
    return out;
  };
  const files = [...walk("app/verify"), "lib/credentials/view.ts", "components/credentials/EvidenceParts.tsx"];
  it("the public certificate pages never touch the passport, profiles, badges or another course's data", () => {
    const FORBIDDEN = [/passport(?!QrSvg|\/qr)/i, /from\("profiles"\)/, /\bbadges?\b/i, /loadProgress/, /loadModuleProofs/, /roadmap/i, /code-dna/i];
    for (const f of files) {
      // only real code counts: comments may say what the page does NOT show
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^import .*passportQrSvg.*$/m, "");
      for (const re of FORBIDDEN) expect(re.test(src), `${f} must not use ${re}`).toBe(false);
    }
  });
  it("the credential view reads one credential and its own modules only", () => {
    const src = readFileSync("lib/credentials/view.ts", "utf8");
    expect(src.match(/\.from\(/g) ?? []).toHaveLength(0);
    expect(src).toContain("loadPassingCode(service, row.user_id, row.subject)");
  });
});
