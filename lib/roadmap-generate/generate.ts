import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { completeStructured } from "@/lib/ai/provider";
import { activateSkills, importChildSkillsAsCandidates, loadTaxonomy } from "@/lib/roadmap-visual/skills-spec";
import { importTemplate } from "@/lib/roadmap-visual/template-store";
import { importCareerExtras } from "@/lib/roadmap-visual/resource-import";
import { draftRoadmap } from "./draft";
import { EXTRAS_TOOL_SCHEMA, ExtrasAnswer, ROADMAP_TOOL_SCHEMA, RoadmapAnswer } from "./model";
import { EXTRAS_SYSTEM, ROADMAP_SYSTEM, extrasPrompt, roadmapPrompt } from "./prompts";
import { publishGenerated } from "./publish";
import { verifyCertification } from "./verify";

type Service = SupabaseClient<Database>;
type Llm = typeof completeStructured;

export interface GenerationReport {
  templateId: string;
  version: number;
  model: string;
  rounds: number;
  topics: number;
  newSkills: number;
  marksCarried: number;
  projects: { proposed: number; saved: number };
  certifications: { proposed: number; verified: number; saved: number };
  warnings: string[];
}

const VERIFY_CONCURRENCY = 4;

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/**
 * Builds, validates and publishes one career's roadmap, then its projects and certifications. Throws (with a message safe to store) when the
 * roadmap itself cannot be produced; a failure of the projects/certifications step only becomes a warning, because the roadmap is already useful.
 */
export async function generateCareerRoadmap(service: Service, careerId: string, deps: { llm?: Llm; verify?: typeof verifyCertification } = {}): Promise<GenerationReport> {
  const llm = deps.llm ?? completeStructured;
  const verify = deps.verify ?? verifyCertification;
  const db = untyped(service);

  const { data: career } = await service.from("careers").select("id, key, name, description, category").eq("id", careerId).eq("is_active", true).maybeSingle();
  if (!career) throw new Error("That career does not exist or is not active.");
  const taxonomy = await loadTaxonomy(service);
  const active = taxonomy.existing.filter((s) => s.status === "active");

  const { data: versions } = await db.from("roadmap_templates").select("id, version, status").eq("career_id", careerId).order("version", { ascending: false });
  const rows = (versions ?? []) as { id: string; version: number; status: string }[];
  const version = (rows[0]?.version ?? 0) + 1;
  const current = rows.find((r) => r.status === "PUBLISHED");
  let keepTopics: string[] = [];
  if (current) {
    const { data: nodes } = await db.from("roadmap_nodes").select("skill_id").eq("template_id", current.id).eq("type", "TOPIC");
    const ids = ((nodes ?? []) as { skill_id: string | null }[]).flatMap((n) => (n.skill_id ? [n.skill_id] : []));
    const { data: skills } = ids.length ? await service.from("skills").select("name").in("id", ids) : { data: [] };
    keepTopics = (skills ?? []).map((s) => s.name);
  }

  const promptCareer = { name: career.name, description: career.description, category: career.category };
  let usedModel = "";
  const drafted = await draftRoadmap({
    careerKey: career.key, careerId, version, taxonomy: { existing: taxonomy.existing, aliases: taxonomy.aliases },
    ask: async (feedback) => {
      const r = await llm({
        system: ROADMAP_SYSTEM, user: roadmapPrompt({ career: promptCareer, skills: active, keepTopics, feedback }),
        toolName: "submit_roadmap", toolDescription: "Submit the finished career roadmap.", inputSchema: ROADMAP_TOOL_SCHEMA, schema: RoadmapAnswer, maxTokens: 16_000, temperature: 0.2,
      });
      usedModel = r.model;
      return { answer: r.value, model: r.model };
    },
  });
  if (!drafted.ok) throw new Error(`The roadmap did not pass validation: ${drafted.errors.slice(0, 6).join(" | ")}`);
  const { draft } = drafted;

  // New skills first (candidate, then active: they were machine-validated against their parent and the existing taxonomy), then the tree that uses them.
  if (draft.newSkills.length) {
    await importChildSkillsAsCandidates(service, draft.newSkills);
    await activateSkills(service, draft.newSkills.map((s) => s.key));
  }
  const saved = await importTemplate(service, draft.spec);
  const published = await publishGenerated(service, saved.id, careerId, usedModel);

  const warnings = [...draft.warnings];
  const topicSkills = draft.spec.nodes.flatMap((n) => (n.type === "TOPIC" && n.skill ? [n.skill] : []));
  const report: GenerationReport = {
    templateId: saved.id, version, model: usedModel, rounds: draft.rounds, topics: topicSkills.length, newSkills: draft.newSkills.length, marksCarried: published.marksCarried,
    projects: { proposed: 0, saved: 0 }, certifications: { proposed: 0, verified: 0, saved: 0 }, warnings,
  };

  try {
    const extras = await llm({
      system: EXTRAS_SYSTEM, user: extrasPrompt({ career: promptCareer, skillNames: topicSkills }),
      toolName: "submit_resources", toolDescription: "Submit the recommended projects and certifications.", inputSchema: EXTRAS_TOOL_SCHEMA, schema: ExtrasAnswer, maxTokens: 8_000, temperature: 0.3,
    });
    const known = new Set(topicSkills);
    const onRoadmap = (names: string[]) => names.filter((n) => known.has(n));
    const projects = extras.value.projects.map((p) => ({ ...p, skills: onRoadmap(p.skills) })).filter((p) => p.skills.length > 0);
    const proposedCerts = extras.value.certifications.map((c) => ({ ...c, skills: onRoadmap(c.skills) })).filter((c) => c.skills.length > 0);
    const checks = await inBatches(proposedCerts, VERIFY_CONCURRENCY, (c) => verify({ name: c.name, provider: c.provider, url: c.url }));
    const certifications = proposedCerts.filter((_, i) => checks[i]);
    report.projects.proposed = extras.value.projects.length;
    report.certifications.proposed = extras.value.certifications.length;
    report.certifications.verified = certifications.length;
    const result = await importCareerExtras(service, { projects, certifications }, async () => true, "AI_CAREER");
    const failed = (names: string[]) => names.filter((n) => result.errors.some((e) => e.startsWith(n))).length;
    report.projects.saved = projects.length - failed(projects.map((p) => p.title));
    report.certifications.saved = certifications.length - failed(certifications.map((c) => c.name));
    warnings.push(...result.errors.slice(0, 10));
    if (certifications.length < proposedCerts.length) warnings.push(`${proposedCerts.length - certifications.length} proposed certification link(s) could not be verified and were dropped.`);
  } catch (error) {
    warnings.push(`Projects and certifications were not generated: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  return report;
}
