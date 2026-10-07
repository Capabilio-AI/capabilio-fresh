import { NextResponse } from "next/server";
import { authorizeOrg } from "@/lib/api/org-route";

const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The skills a SKILL row may name: the active Capabilio skills, with the aliases that are also accepted. */
export async function GET() {
  const env = await authorizeOrg("manageCurriculum");
  if (env instanceof NextResponse) return env;
  const [{ data: skills }, { data: aliases }] = await Promise.all([
    env.service.from("skills").select("id, name, category").eq("status", "active").order("category").order("name"),
    env.service.from("skill_aliases").select("skill_id, alias"),
  ]);
  const alsoFor = new Map<string, string[]>();
  for (const a of aliases ?? []) alsoFor.set(a.skill_id, [...(alsoFor.get(a.skill_id) ?? []), a.alias]);
  const body = ["skill,category,also_accepted_as", ...(skills ?? []).map((s) => [s.name, s.category ?? "", (alsoFor.get(s.id) ?? []).join("; ")].map(q).join(","))].join("\n");
  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="capabilio-skills-list.csv"', "Cache-Control": "private, max-age=600" },
  });
}
