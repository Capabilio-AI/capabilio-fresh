import type { ResumeExtraction } from "@/lib/ai/llm/prompts/resume.v1";
import type { ApplySummary } from "./apply";

/** What the resume screen shows after reading: names the counts and the skills, never the raw text. */
export interface ResumeSummary {
  name: string | null;
  headline: string | null;
  counts: { education: number; projects: number; experience: number; certifications: number; skills: number };
  skills: string[];
  /** what was written into the profile, education history and vault */
  applied: ApplySummary | null;
}

export function summariseResume(x: ResumeExtraction, skills: string[], applied: ApplySummary | null): ResumeSummary {
  return {
    name: x.personal.fullName,
    headline: x.summary.headline,
    counts: { education: x.education.length, projects: x.projects.length, experience: x.experience.length, certifications: x.certifications.length, skills: skills.length },
    skills: skills.slice(0, 18),
    applied,
  };
}
