import { afterAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@supabase/supabase-js";
import { loadSkillIndex, recordUnresolved } from "./store";
import { resolveSkill } from "./resolve";
import { normalizeSkillText } from "./normalize";

const service = createServiceClient();
const PROBE = "zz-live-test unresolvable probe";

afterAll(async () => {
  await service.from("skill_suggestions").delete().eq("normalized_text", normalizeSkillText(PROBE));
});

describe("canonical skills (live)", () => {
  it("resolves different spellings to one skill and keeps candidates out", async () => {
    const index = await loadSkillIndex(service);
    const a = resolveSkill("Python Programming", index);
    expect(a).not.toBeNull();
    expect(resolveSkill("python language", index)?.skillId).toBe(a!.skillId);
    expect(resolveSkill("Career Interest Signal", index)).toBeNull(); // an old candidate row
  });

  it("every Arena skill area is linked to an active canonical skill", async () => {
    const { data: areas } = await service.from("arena_skill_areas").select("area_key, skill_id").eq("role_key", "data-analyst");
    expect((areas ?? []).length).toBeGreaterThan(0);
    const { data: skills } = await service.from("skills").select("id, status").in("id", (areas ?? []).map((a) => a.skill_id!).filter(Boolean));
    expect((skills ?? []).every((s) => s.status === "active")).toBe(true);
    expect((areas ?? []).every((a) => a.skill_id)).toBe(true);
  });

  it("unresolved text is queued and never becomes a skill", async () => {
    const before = (await service.from("skills").select("id", { count: "exact", head: true })).count;
    await recordUnresolved(service, PROBE, "other");
    await recordUnresolved(service, PROBE, "other");
    const { data } = await service.from("skill_suggestions").select("occurrences, status").eq("normalized_text", normalizeSkillText(PROBE)).single();
    expect(data).toEqual({ occurrences: 2, status: "pending" });
    expect((await service.from("skills").select("id", { count: "exact", head: true })).count).toBe(before);
  });

  it("a signed-out client can read the taxonomy but cannot write it or read suggestions", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    expect(((await anon.from("skills").select("id").limit(1)).data ?? []).length).toBe(1);
    expect((await anon.from("skills").update({ status: "deprecated" }).eq("key", "SKILL_SQL")).error).not.toBeNull();
    expect((await anon.from("skill_aliases").insert({ alias: "zz probe", skill_id: "00000000-0000-0000-0000-000000000000" })).error).not.toBeNull();
    expect((await anon.from("skill_suggestions").select("normalized_text").limit(1)).error).not.toBeNull();
  });
});
