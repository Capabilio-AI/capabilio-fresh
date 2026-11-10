import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { loadCareerSkills, type Db } from "@/lib/assess/db";
import { getCareerIntent } from "@/lib/careers/intent";
import { chooseDomainCareer } from "@/lib/arena-challenges/career-state";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { generateJobPack, loadJobPack, type JobPack } from "@/lib/market/job-pack";
import { matchJob } from "@/lib/market/match";
import { loadVocab, refreshMarket } from "@/lib/market/store";

// A stale or missing market snapshot is fetched here (a few requests to the job-data service) and a missing pack is written once.
export const maxDuration = 60;

const TOP_SKILLS = 20;

/**
 * The student's job pack for their chosen role: what the live market says (pay, who hires, where, which skills are asked for and how the
 * student's own levels compare), real openings with how close the student is to each, and the interview and resume prep for the role.
 * Every number is from live postings or the student's own scores; the AI only writes the prep.
 */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "job_pack", 20);
  if (limited) return limited;
  try {
    const service = createServiceClient();
    const which = new URL(request.url).searchParams.get("career") === "plan-b" ? "plan-b" : "primary";
    const { intent } = await getCareerIntent(service, auth.userId);
    const chosen = chooseDomainCareer(intent, which);
    if (chosen.state !== "ready") throw new AssessError("NO_CAREER", "Choose a career first.", 409);
    const career = chosen.career;

    const market = await refreshMarket(service, { id: career.id, name: career.name });
    let pack: JobPack | null = await loadJobPack(service, career.id);
    if (!pack) {
      const skills = await loadCareerSkills(service as unknown as Db, career.id);
      if (skills.length > 0) pack = await generateJobPack(service, { id: career.id, name: career.name }, skills.map((s) => s.name), market).catch((e) => { console.error("[job-pack]", e instanceof Error ? e.message : e); return null; });
    }

    const [caps, vocab] = await Promise.all([loadStudentCapabilities(service, auth.userId), loadVocab(service)]);
    const levels = new Map([...caps.bySkill].map(([id, c]) => [id, c.level]));
    const nameOf = new Map(vocab.map((s) => [s.id, s.name]));

    return NextResponse.json({
      career: { id: career.id, name: career.name },
      market: market && {
        sampled: market.sampled, fetchedAt: market.fetchedAt, salary: market.salary, titles: market.titles, companies: market.companies, locations: market.locations,
        topSkills: market.topSkills.filter((s) => s.postings >= 2).slice(0, TOP_SKILLS).map((s) => ({ skillId: s.skillId, name: s.name, share: s.share, yourLevel: levels.get(s.skillId) ?? null })),
      },
      jobs: (market?.jobs ?? [])
        .map((j) => ({ ...j, match: matchJob(j, levels, nameOf) }))
        .sort((a, b) => (b.match.percent ?? -1) - (a.match.percent ?? -1) || Date.parse(b.created ?? "") - Date.parse(a.created ?? "")),
      pack,
    });
  } catch (e) {
    return failureResponse(e, "job_pack");
  }
}
