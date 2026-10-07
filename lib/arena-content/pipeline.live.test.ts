import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUserWithLogin, deleteThrowawayUser, liveServiceClient, signedInClient } from "@/lib/arena-workstations/live-test-helpers";
import { untyped } from "@/lib/org/db";
import { loadStreamPool } from "@/lib/arena-challenges/stream-context";
import { validateStored } from "./admin-actions";
import { importSpec, isPlatformAdmin, listChallenges, markValidated, publishChallenge, retireChallenge, upsertTemplates } from "./store";
import { TemplateSpec } from "./spec";

// Live: authored spec -> draft -> validate -> publish -> visible to students (and only then), against the real database.
const service = liveServiceClient();
const db = untyped(service);
const KEY = "zz-live-pipeline";
const BRANCH = "zz live branch";
let student: { userId: string; email: string; password: string };
let spec: Record<string, unknown>;

beforeAll(async () => {
  const templates = TemplateSpec.array().parse(JSON.parse(readFileSync("content/arena/templates.json", "utf8")));
  await upsertTemplates(service, templates);
  const seeds = JSON.parse(readFileSync("content/arena/seed/stream-civil-mech.json", "utf8")) as Record<string, unknown>[];
  spec = { ...seeds[0], key: KEY, branches: [BRANCH], isSeed: false, title: "Live pipeline test beam" };
  student = await createThrowawayUserWithLogin(service, "pipeline");
});
afterAll(async () => {
  await db.from("arena_challenges").delete().eq("spec_key", KEY);
  await deleteThrowawayUser(service, student.userId);
});

describe("authoring pipeline", () => {
  it("imports as a DRAFT that students cannot see, and refuses to publish before validation", async () => {
    const r = await importSpec(service, spec);
    expect(r.changed).toBe(true);
    expect((await importSpec(service, spec)).changed).toBe(false); // unchanged -> no-op
    await expect(publishChallenge(service, { key: KEY }, null)).rejects.toMatchObject({ status: 409 });
    expect(await loadStreamPool(service, { scopeKey: "none", branchKey: BRANCH })).toEqual([]);
    const asStudent = await signedInClient(student.email, student.password);
    const { data } = await asStudent.from("arena_challenges").select("id").eq("id", r.id);
    expect(data).toEqual([]);
  });

  it("validates, publishes, and then shows only the safe columns to a student", async () => {
    const id = (await listChallenges(service)).find((c) => c.specKey === KEY)!.id;
    const report = await validateStored(service, id);
    expect(report).toMatchObject({ ok: true, evidenceStatus: "VERIFIED_AUTOMATED" });
    await publishChallenge(service, { key: KEY }, null);

    const pool = await loadStreamPool(service, { scopeKey: "none", branchKey: BRANCH });
    expect(pool.map((c) => c.id)).toEqual([id]);

    const asStudent = await signedInClient(student.email, student.password);
    const visible = await asStudent.from("arena_challenges").select("id, ticket_brief, status").eq("id", id);
    expect(visible.data?.[0]).toMatchObject({ id, status: "PUBLISHED" });
    expect((await asStudent.from("arena_challenges").select("spec").eq("id", id)).error).not.toBeNull(); // answers are not granted
    expect((await untyped(asStudent).from("challenge_checks").select("config")).error).not.toBeNull();
  });

  it("an edit sends a published challenge back to DRAFT and clears its validation", async () => {
    const edited = { ...spec, title: "Live pipeline test beam (edited)" };
    expect((await importSpec(service, edited)).changed).toBe(true);
    expect(await loadStreamPool(service, { scopeKey: "none", branchKey: BRANCH })).toEqual([]);
    const item = (await listChallenges(service)).find((c) => c.specKey === KEY)!;
    expect(item).toMatchObject({ status: "DRAFT", validated: false });
    await expect(publishChallenge(service, { key: KEY }, null)).rejects.toMatchObject({ status: 409 });
    await markValidated(service, { key: KEY });
    await publishChallenge(service, { key: KEY }, null);
    await retireChallenge(service, { key: KEY });
    expect(await loadStreamPool(service, { scopeKey: "none", branchKey: BRANCH })).toEqual([]);
  });

  it("an invalid spec fails validation and is never marked validated", async () => {
    const broken = { ...spec, title: "Live pipeline broken", reference: { answers: { reaction: "1", mmax: "1" } } };
    const { id } = await importSpec(service, broken);
    const report = await validateStored(service, id);
    expect(report.ok).toBe(false);
    expect(report.errors.join(" ")).toMatch(/reference solution fails/);
    await expect(publishChallenge(service, { id }, null)).rejects.toMatchObject({ status: 409 });
  });

  it("the database refuses to publish AI content without a reviewer", async () => {
    const { data } = await db.from("arena_challenges").insert({ track: "stream", scope_key: "zz-live-ai", title: "ai draft", category: "c", difficulty: "easy", scenario: "s", objective: "o", language: "python", expected_output: "x", spec_key: "zz-live-ai-draft" }).select("id, status, active").single();
    expect(data).toMatchObject({ status: "DRAFT", active: false });
    if (!data) throw new Error("insert failed");
    const blocked = await db.from("arena_challenges").update({ status: "PUBLISHED" }).eq("id", data.id);
    expect(blocked.error?.message).toMatch(/ai_must_be_reviewed/);
    await db.from("arena_challenges").delete().eq("id", data.id);
  });

  it("only listed users are platform admins", async () => {
    expect(await isPlatformAdmin(service, student.userId)).toBe(false);
  });
});
