import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";
import type { GithubScanResult } from "./github-scan";

const FingerprintSchema = z.object({
  authenticity_score: z.number().min(0).max(100),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().min(1),
  recruiter_summary: z.string().min(1),
});

export interface Fingerprint {
  score: number;
  confidence: "low" | "medium" | "high";
  summary: string;
  recruiterSummary: string;
}

function buildSystemPrompt(): string {
  return `You are scoring a student's GitHub activity as engineering evidence for a career platform.
You are given REAL, already-scanned facts about their public repositories — file-presence tech signals, README/test-directory presence, fork status, a commit-authorship sample, and pull request counts. Never invent facts beyond what's given, and never claim to have run a plagiarism or code-quality check — none happened.
Score authenticity_score (0-100) on: breadth of real technical footprint, evidence of original authorship (non-fork repos, high authorCommitShare), engineering practice (tests/CI/README), and real collaboration (merged PRs). A student with few repos but strong authorship evidence should score reasonably — don't penalize for volume alone.
confidence: "low" if repositoriesAnalyzed is 0-1, "medium" for 2-3, "high" for 4+.
summary: 2-3 sentences, addressed to the student.
recruiter_summary: 1-2 sentences, factual, third-person, no hiring-probability language, no guarantees — describes what the evidence shows, never what it predicts.
Respond with JSON only: {"authenticity_score": number, "confidence": "low"|"medium"|"high", "summary": string, "recruiter_summary": string}`;
}

export async function scoreFingerprint(scan: GithubScanResult): Promise<Fingerprint> {
  const result = await completeJson(JSON.stringify(scan, null, 2), buildSystemPrompt(), FingerprintSchema);
  return {
    score: Math.round(result.authenticity_score),
    confidence: result.confidence,
    summary: result.summary,
    recruiterSummary: result.recruiter_summary,
  };
}
