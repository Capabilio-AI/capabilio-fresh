import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStudentDirection, needsYearConfirmation } from "@/lib/career/direction";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { getWorkstationState } from "@/lib/arena-workstations/attempts";
import { buildRoadmap, type Roadmap, type RoadmapInput } from "./build";

export type RoadmapResult = { applicable: false } | { applicable: true; roadmap: Roadmap };

type Service = SupabaseClient<Database>;

/**
 * Assembles the engine's input from real, stored data and runs it — on every call, nothing cached.
 * Job track only (the resolution is the one the Job-Track work already exposes: unset and "not sure"
 * count as job). `client` is the caller's own session client; `service` is used only for reads the
 * browser is deliberately denied (curriculum tables) after the caller is known.
 */
export async function loadRoadmapForStudent(client: Service, service: Service, userId: string): Promise<RoadmapResult> {
  const direction = await getStudentDirection(client, userId);
  if (!direction || direction.track !== "job") return { applicable: false };

  // The year is only used once the student has confirmed it — never a silent guess.
  const academicYear = needsYearConfirmation(direction) ? null : direction.academicYear?.year ?? null;

  let workstation: Awaited<ReturnType<typeof getWorkstationState>> | null = null;
  try {
    workstation = await getWorkstationState(service, userId, await getStatedCareerInterest(client, userId));
  } catch {
    workstation = null; // no domain role configured
  }

  const empty: RoadmapInput = { role: null, areas: [], targets: [], verified: {}, academicYear, subjects: [], resources: [] };
  if (!workstation) return { applicable: true, roadmap: buildRoadmap(empty) };
  const roleKey = workstation.role.key;

  const [{ data: targets }, { data: resources }, { data: subjectRows }] = await Promise.all([
    service.from("role_target_profiles").select("area_key, min_verified_count").eq("role_key", roleKey),
    service.from("skill_area_resources").select("area_key, kind, title, url, description").eq("role_key", roleKey).eq("active", true),
    direction.institutionId
      ? service.from("curriculum_subjects").select("id, branch, year, name").eq("institution_id", direction.institutionId)
      : Promise.resolve({ data: [] as { id: string; branch: string; year: number; name: string }[] }),
  ]);

  const branch = direction.branch?.trim().toLowerCase();
  const mine = (subjectRows ?? []).filter((s) => branch && s.branch.trim().toLowerCase() === branch);
  const { data: maps } = mine.length
    ? await service.from("curriculum_subject_skill_map").select("subject_id, area_key").eq("role_key", roleKey).in("subject_id", mine.map((s) => s.id))
    : { data: [] as { subject_id: string; area_key: string }[] };

  return {
    applicable: true,
    roadmap: buildRoadmap({
      role: { key: roleKey, name: workstation.role.label },
      areas: workstation.progress.map((p) => ({ key: p.key, name: p.name, enabled: p.enabled })),
      targets: (targets ?? []).map((t) => ({ areaKey: t.area_key, minVerified: t.min_verified_count })),
      verified: Object.fromEntries(workstation.progress.map((p) => [p.key, p.verifiedCount])),
      academicYear,
      subjects: mine.map((s) => ({ id: s.id, name: s.name, year: s.year, areaKeys: (maps ?? []).filter((m) => m.subject_id === s.id).map((m) => m.area_key) })),
      resources: (resources ?? []).map((r) => ({ areaKey: r.area_key, kind: r.kind as "project" | "certification" | "practice", title: r.title, url: r.url, description: r.description })),
    }),
  };
}
