import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Db } from "@/lib/assess/db";
import { getPortfolioData, type ArenaTask } from "@/lib/portfolio/data";
import type { CapabilityGroup } from "@/lib/portfolio/view";
import { loadPassportSkills, type PassportSkills } from "./data";
import { ensurePassportNumber } from "./issue";
import type { ReelInput } from "./reel";

/** A short, stable summary of the evidence the reel shows: it changes the moment any of that evidence changes. */
export function evidenceFingerprint(parts: unknown): string {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16).toUpperCase();
  return hex.match(/.{4}/g)!.join("-");
}

/** What a person who scans the QR can look through: the verified work behind the badges. Nothing private (no files, no email). */
export interface PublicEvidence {
  groups: CapabilityGroup[];
  arena: ArenaTask[];
  proofs: { id: string; title: string; kind: string; url: string | null; addedAt: string }[];
  github: { username: string; profileUrl: string; repositories: number | null } | null;
  interviews: { count: number; best: number; average: number } | null;
}

export interface ReelBundle {
  input: ReelInput;
  passport: PassportSkills;
  evidence: PublicEvidence;
}

const httpsOnly = (url: string | null) => (url && /^https:\/\//i.test(url) ? url : null);

/** Everything the proof reel and the passport pages show, built from verified evidence only (service client; the caller owns the access check). */
export async function loadReel(service: SupabaseClient<Database>, userId: string): Promise<ReelBundle> {
  const [portfolio, passport, passportNo] = await Promise.all([getPortfolioData(service, userId), loadPassportSkills(service as unknown as Db, userId), ensurePassportNumber(service, userId)]);
  const badges = passport.skills.flatMap((s) => (s.badge ? [{ name: s.badge.name, level: s.badge.level, provisional: s.badge.provisional }] : []));
  const verified = portfolio.items.filter((v) => v.verified);
  const proofs = verified.map((v) => ({ title: v.title, kind: v.item_type }));
  const github = portfolio.github?.verified ? { username: portfolio.github.username, repositories: portfolio.github.repositoriesAnalyzed } : null;
  const history = passport.elo?.history.map((h) => h.rating) ?? [];
  const scores = portfolio.interviews.map((x) => x.overallScore);
  const interviews = scores.length ? { count: scores.length, best: Math.max(...scores), average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) } : null;

  const fingerprint = evidenceFingerprint({ badges, arena: portfolio.arenaTasks.map((a) => a.attemptId), proofs, github: github?.username ?? null, interviews, snapshot: passport.snapshotId });
  const v = portfolio.viewer;
  return {
    passport,
    input: {
      holder: { name: v.fullName ?? "Capabilio student", college: v.collegeName, branch: v.branch, classOf: v.direction?.endYear ?? null, aspiringFor: passport.roleName ?? portfolio.statedRole, passportNo },
      badges,
      elo: passport.elo ? { rating: passport.elo.rating, history } : null,
      arenaPassed: portfolio.arenaTasks.length,
      arena: portfolio.arenaTasks.map((a) => ({ title: a.title, company: a.company, area: a.area })),
      interviews,
      proofs,
      github,
      fingerprint,
      measuredAt: passport.updatedAt,
    },
    evidence: {
      groups: portfolio.groups,
      arena: portfolio.arenaTasks,
      proofs: verified.map((x) => ({ id: x.id, title: x.title, kind: x.item_type, url: httpsOnly(x.url), addedAt: x.created_at })),
      github: portfolio.github?.verified ? { username: portfolio.github.username, profileUrl: portfolio.github.profileUrl, repositories: portfolio.github.repositoriesAnalyzed } : null,
      interviews,
    },
  };
}
