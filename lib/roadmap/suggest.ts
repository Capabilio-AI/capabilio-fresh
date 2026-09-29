import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";

export interface AreaOption {
  key: string;
  name: string;
}

/**
 * PROPOSE ONLY. Returns skill-area keys the model thinks a subject builds. It has no database access
 * and its output is filtered to real keys; nothing here is ever saved — the admin must confirm.
 */
export async function suggestAreasForSubject(subjectName: string, roleName: string, areas: AreaOption[]): Promise<string[]> {
  const valid = new Set(areas.map((a) => a.key));
  const list = areas.map((a) => `- ${a.key}: ${a.name}`).join("\n");
  const result = await completeJson(
    `University subject: "${subjectName}".\nWhich of these ${roleName} skill areas does studying this subject directly build? Choose only clear matches; an empty list is a valid answer.\n${list}\nReturn JSON: {"areas": string[]} using only the keys above.`,
    "You map university subjects to professional skill areas conservatively. You never invent keys.",
    z.object({ areas: z.array(z.string()) })
  );
  return [...new Set(result.areas.filter((k) => valid.has(k)))];
}
