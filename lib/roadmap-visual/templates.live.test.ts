import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { exportTemplate, importTemplate, listTemplates, publishTemplate, retireTemplate, reviewTemplate } from "./template-store";

// Live: authored tree -> draft -> reviewed -> published, with the rules enforced by the real database.
const service = liveServiceClient();
const db = untyped(service);
const CAREER = "cybersecurity-analyst";
let admin: string;
let student: { userId: string; email: string; password: string };

const node = (key: string, over: Record<string, unknown>) => ({ key, parent: null, type: "TOPIC", title: key, description: "A description that is long enough.", skill: null, importance: "CORE", target: null, stage: "FOUNDATION", side: "LEFT", order: 1, ...over });
const spec = (version: number, over: Record<string, unknown> = {}) => ({
  career: CAREER, version, title: "zz live tree", provenance: { designedBy: "Capabilio", method: "A live test fixture built from active skills." },
  nodes: [
    node("stage-one", { type: "SPINE", side: "CENTER", title: "Stage one" }),
    node("g-left", { type: "GROUP", parent: "stage-one", title: "Group" }),
    node("sql-topic", { parent: "g-left", skill: "SQL", target: 70, title: "SQL" }),
    node("python-topic", { parent: "g-left", skill: "Python", target: 60, title: "Python", order: 2 }),
  ],
  edges: [{ from: "sql-topic", to: "python-topic", type: "PREREQUISITE" }],
  ...over,
});

beforeAll(async () => {
  admin = await createThrowawayUser(service, "tpl-admin");
  student = await createThrowawayUserWithLogin(service, "tpl-student");
});
afterAll(async () => {
  await db.from("roadmap_templates").delete().eq("title", "zz live tree");
  await deleteThrowawayUser(service, admin);
  await deleteThrowawayUser(service, student.userId);
});

describe("template lifecycle", () => {
  let id: string;
  it("imports as a DRAFT, is a no-op when unchanged, and round-trips through export", async () => {
    const r = await importTemplate(service, spec(9100));
    expect(r).toMatchObject({ created: true, changed: true });
    id = r.id;
    expect(await importTemplate(service, spec(9100))).toMatchObject({ id, created: false, changed: false });
    const { spec: out, status } = await exportTemplate(service, id);
    expect(status).toBe("DRAFT");
    expect(out.nodes.map((n) => [n.key, n.parent, n.skill, n.target])).toEqual(expect.arrayContaining([["sql-topic", "g-left", "SQL", 70], ["stage-one", null, null, null]]));
    expect(out.edges).toEqual([{ from: "sql-topic", to: "python-topic", type: "PREREQUISITE" }]);
    const listed = (await listTemplates(service)).find((t) => t.id === id)!;
    expect(listed).toMatchObject({ status: "DRAFT", careerKey: CAREER, version: 9100, topics: 2 });
  });

  it("cannot be published before review, and review records the reviewer", async () => {
    await expect(publishTemplate(service, id)).rejects.toMatchObject({ status: 409 });
    await reviewTemplate(service, id, admin);
    const { data } = await db.from("roadmap_templates").select("status, reviewed_by").eq("id", id).single();
    expect(data).toMatchObject({ status: "REVIEWED", reviewed_by: admin });
    await expect(reviewTemplate(service, id, admin)).rejects.toMatchObject({ status: 409 });
  });

  it("publishing makes it visible to students; a new published version retires the old one", async () => {
    await publishTemplate(service, id);
    const asStudent = await signedInClient(student.email, student.password);
    const seen = await untyped(asStudent).from("roadmap_templates").select("id, version").eq("career_id", (await service.from("careers").select("id").eq("key", CAREER).single()).data!.id);
    expect((seen.data as { id: string }[]).map((t) => t.id)).toContain(id);

    const second = await importTemplate(service, spec(9101));
    await reviewTemplate(service, second.id, admin);
    await publishTemplate(service, second.id);
    expect((await db.from("roadmap_templates").select("status").eq("id", id).single()).data?.status).toBe("RETIRED");
    expect((await db.from("roadmap_templates").select("status").eq("id", second.id).single()).data?.status).toBe("PUBLISHED");
    await retireTemplate(service, second.id);
  });

  it("a published or retired version is never rewritten: a change is a new version", async () => {
    await expect(importTemplate(service, spec(9100, { title: "zz live tree" }))).rejects.toMatchObject({ status: 409 });
  });

  it("edits to a draft replace its nodes and clear review", async () => {
    const d = await importTemplate(service, spec(9102));
    await reviewTemplate(service, d.id, admin);
    // an edit sends it back to DRAFT; a change made behind the pipeline's back is caught at review
    const changed = spec(9102, { nodes: [...spec(9102).nodes, node("extra", { parent: "g-left", skill: "Statistics", target: 50, title: "Statistics", order: 3 })] });
    expect(await importTemplate(service, changed)).toMatchObject({ id: d.id, changed: true });
    expect((await db.from("roadmap_templates").select("status, reviewed_by").eq("id", d.id).single()).data).toMatchObject({ status: "DRAFT", reviewed_by: null });
    await db.from("roadmap_nodes").update({ title: "tampered" }).eq("template_id", d.id).eq("node_key", "extra"); // title is not in the hash... but the skill is
    await db.from("roadmap_nodes").update({ target_level: 99 }).eq("template_id", d.id).eq("node_key", "extra");
    await expect(reviewTemplate(service, d.id, admin)).rejects.toMatchObject({ status: 409 });
  });
});

describe("what the pipeline refuses", () => {
  it("a skill that does not exist, or that is still awaiting review, stops the import", async () => {
    const ghost = spec(9200, { nodes: spec(9200).nodes.map((n) => (n.key === "sql-topic" ? { ...n, skill: "Imaginary Skill" } : n)) });
    await expect(importTemplate(service, ghost)).rejects.toMatchObject({ message: expect.stringMatching(/does not exist in the taxonomy/) });
    const da = JSON.parse(readFileSync("content/roadmaps/data-analyst.v1.json", "utf8"));
    const { data: pending } = await service.from("skills").select("id").eq("key", "SKILL_SQL_JOINS").eq("status", "candidate");
    if (pending?.length) await expect(importTemplate(service, da)).rejects.toMatchObject({ message: expect.stringMatching(/is candidate, not active/) });
  });
  it("a cycle among prerequisites stops the import", async () => {
    const cyc = spec(9201, { edges: [{ from: "sql-topic", to: "python-topic", type: "PREREQUISITE" }, { from: "python-topic", to: "sql-topic", type: "PREREQUISITE" }] });
    await expect(importTemplate(service, cyc)).rejects.toMatchObject({ message: expect.stringMatching(/Prerequisite cycle/) });
  });
});
