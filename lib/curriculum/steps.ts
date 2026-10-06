/** The review wizard's steps, in order, exactly as the product describes them. */
export const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "structure", label: "Academic structure" },
  { key: "courses", label: "Courses" },
  { key: "outcomes", label: "Learning outcomes" },
  { key: "mappings", label: "Skill mappings" },
  { key: "relevance", label: "Career relevance" },
  { key: "confirm", label: "Confirm" },
  { key: "publish", label: "Publish" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export function stepFrom(value: string | string[] | undefined): StepKey {
  const v = Array.isArray(value) ? value[0] : value;
  return STEPS.find((s) => s.key === v)?.key ?? "upload";
}
