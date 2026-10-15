// The graduate job-hunt pipeline: pure, so it is unit-tested without a database.

export type StepKey = "level" | "proof" | "interview" | "apply";

export interface PipelineStep {
  key: StepKey;
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

/** The four stations of a job hunt, each done only when real data says so. */
export function buildPipeline(x: { hasLevel: boolean; proofCount: number; interviewCount: number; applicationCount: number }): PipelineStep[] {
  return [
    { key: "level", label: "Know your level", detail: x.hasLevel ? "Assessment done" : "Take the career assessment", href: "/assessment", done: x.hasLevel },
    { key: "proof", label: "Build proof", detail: x.proofCount > 0 ? `${x.proofCount} in your vault` : "Add a project or certificate", href: "/dashboard/portfolio", done: x.proofCount > 0 },
    { key: "interview", label: "Practise interviews", detail: x.interviewCount > 0 ? `${x.interviewCount} practised` : "Try an AI mock round", href: "/dashboard/interview", done: x.interviewCount > 0 },
    { key: "apply", label: "Apply", detail: x.applicationCount > 0 ? `${x.applicationCount} applied` : "Browse Launchpad listings", href: "/launchpad", done: x.applicationCount > 0 },
  ];
}

/** The first station not yet done: where the graduate is in their job hunt. Null once all four are. */
export const currentStep = (steps: readonly PipelineStep[]): PipelineStep | null => steps.find((s) => !s.done) ?? null;
