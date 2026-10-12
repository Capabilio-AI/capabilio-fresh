import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayUser, deleteThrowawayUser, liveServiceClient } from "@/lib/arena-workstations/live-test-helpers";
import { getOnboardingStatus, type Db } from "@/lib/assess/db";
import { submitSession } from "@/lib/assess/finalize";
import { getFlowSnapshot } from "@/lib/assess/flow";
import { generateFeedback } from "@/lib/assess/feedback";
import { studentGate } from "@/lib/assess/gate";
import { answerQuestion, getState, nextQuestion, startSession } from "@/lib/assess/session";
import { applyResume } from "./apply";
import { readResumePdf } from "./analyse";
import { resumeSkillNames } from "./focus";
import type { ResumeExtraction } from "@/lib/ai/llm/prompts/resume.v1";

// Real database and the real model. Throwaway user; everything it creates is removed afterwards.
const service = liveServiceClient();
const db = service as unknown as Db;
let userId = "";
let extraction: ResumeExtraction;
const COLLEGE = "Capabilio Sample Institute of Technology";
const SCHOOL = "Sample Junior College";

beforeAll(async () => {
  userId = await createThrowawayUser(service, "grad");
  // the signup trigger reads the metadata; this is exactly what the graduate form sends
  await service.auth.admin.updateUserById(userId, { user_metadata: { full_name: "Asha Rao", role: "student", student_status: "graduate" } });
  await db.from("profiles").update({ student_status: "graduate", full_name: "Asha Rao" }).eq("id", userId);
}, 60_000);

afterAll(async () => {
  const { data: inst } = await db.from("institutions").select("id").in("name", [COLLEGE, SCHOOL]);
  await db.from("product_events").delete().eq("user_id", userId);
  await deleteThrowawayUser(service, userId);
  for (const i of inst ?? []) await db.from("institutions").delete().eq("id", (i as { id: string }).id);
});

describe("recently graduated account", () => {
  it("is never locked, and starts at the resume step", async () => {
    expect(await studentGate(db, userId)).toMatchObject({ locked: false, graduate: true });
    const snap = await getFlowSnapshot(db, userId);
    expect(snap.stage).toBe("resume");
    expect(snap.graduate).toMatchObject({ hasResume: false });
  });

  it("reads the resume and fills the profile, education history and vault", async () => {
    const read = await readResumePdf(new Uint8Array(readFileSync("lib/graduate/fixtures/sample-resume.pdf")));
    expect(read.ok, read.ok ? "" : read.message).toBe(true);
    if (!read.ok) return;
    extraction = read.extraction;
    expect(extraction.education.some((e) => /sample institute/i.test(e.institution))).toBe(true);
    expect(extraction.skills.map((s) => s.toLowerCase())).toEqual(expect.arrayContaining(["python", "sql"]));
    expect(extraction.projects.length).toBeGreaterThanOrEqual(2);

    await db.from("graduate_resumes").upsert({ user_id: userId, file_name: "sample-resume.pdf", extraction, skill_names: resumeSkillNames(extraction), model: read.model });
    const applied = await applyResume(db, userId, extraction);
    expect(applied.education).toBeGreaterThanOrEqual(1);
    expect(applied.projects).toBeGreaterThanOrEqual(2);

    const { data: profile } = await db.from("profiles").select("headline, bio, location").eq("id", userId).single();
    expect(profile?.headline || profile?.bio).toBeTruthy();
    const { data: edu } = await db.from("institution_memberships").select("degree, end_year").eq("user_id", userId);
    expect((edu ?? []).length).toBeGreaterThanOrEqual(1);
    const { data: vault } = await db.from("vault_items").select("item_type, verified").eq("user_id", userId);
    expect((vault ?? []).filter((v) => v.item_type === "project")).toHaveLength(extraction.projects.length);
    expect((vault ?? []).every((v) => v.verified === false)).toBe(true);

    // applying the same resume again adds nothing: no duplicates
    const again = await applyResume(db, userId, extraction);
    expect(again).toMatchObject({ education: 0, projects: 0, experience: 0, certifications: 0, links: 0 });
  }, 120_000);

  it("then asks for the role, and the one role assessment needs no general layer", async () => {
    expect((await getFlowSnapshot(db, userId)).stage).toBe("career-interest");
    const careerId = (await db.from("careers").select("id").eq("key", "data-analyst").single()).data!.id as string;
    await db.from("student_career_intent").upsert({ student_id: userId, primary_career_id: careerId, is_exploring: false }, { onConflict: "student_id" });
    const snap = await getFlowSnapshot(db, userId);
    expect(snap.stage).toBe("career");
    expect(snap.graduate?.focus).toEqual(expect.arrayContaining(["SQL", "Python"]));
    expect(await getOnboardingStatus(db, userId)).toBe("ASSESSMENT_REQUIRED"); // general was never taken
  });

  it("weights the assessment to the resume, scores it, gives AI feedback and unlocks everything", async () => {
    const started = await startSession(db, userId, "CAREER");
    expect(started.layer).toBe("CAREER");
    const { data: sess } = await db.from("assess_sessions").select("focus_skill_ids").eq("id", started.sessionId).single();
    expect((sess?.focus_skill_ids as string[]).length).toBeGreaterThanOrEqual(2);

    let state = started.state;
    const asked: Record<string, number> = {};
    for (let i = 0; i < started.total; i++) {
      const q = state.current!.question;
      asked[q.skillName] = (asked[q.skillName] ?? 0) + 1;
      const { data: sq } = await db.from("assess_session_questions").select("option_order, pool_question_id").eq("id", q.sessionQuestionId).single();
      const { data: pool } = await db.from("assess_question_pool").select("correct_index").eq("id", sq!.pool_question_id).single();
      const pick = (sq!.option_order as number[]).indexOf(pool!.correct_index);
      await answerQuestion(db, userId, { sessionQuestionId: q.sessionQuestionId, attemptId: crypto.randomUUID(), optionIndex: pick, responseMs: 1200 });
      if (i < started.total - 1) {
        await nextQuestion(db, userId, started.sessionId);
        state = await getState(db, userId, started.sessionId);
      }
    }
    // every skill the resume claims is tested at least once
    for (const name of ["SQL", "Python"]) expect(asked[name] ?? 0).toBeGreaterThanOrEqual(1);

    const result = await submitSession(db, userId, started.sessionId);
    expect(result.elo?.newElo).toBeGreaterThan(400);
    expect(await getOnboardingStatus(db, userId)).toBe("PROFILE_READY");
    expect(await studentGate(db, userId)).toMatchObject({ locked: false });
    expect((await getFlowSnapshot(db, userId)).stage).toBe("done");

    const feedback = await generateFeedback(db, userId, started.sessionId, result);
    expect(feedback.length).toBeGreaterThan(0);
  }, 590_000);
});
