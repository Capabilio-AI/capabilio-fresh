import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ChallengeSpec } from "./spec";
import { sqlJsRunner } from "./sqljs-runner";
import { runLocalPython } from "./python-runner";
import { approveLegacyDraft, ContentError, loadReferenceData, markValidated, publishChallenge, retireChallenge } from "./store";
import { validateSpec, type ValidationReport } from "./validate";

type Service = SupabaseClient<Database>;

/** Validates the spec stored on a challenge and, if it passes, records that (publishing requires it). */
export async function validateStored(service: Service, id: string): Promise<ValidationReport> {
  const { data } = await untyped(service).from("arena_challenges").select("spec").eq("id", id).is("user_id", null).maybeSingle();
  if (!data?.spec) throw new ContentError("This challenge has no spec to validate.", 404);
  const parsed = ChallengeSpec.safeParse(data.spec);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [], evidenceStatus: null };
  const report = await validateSpec(parsed.data, { ...(await loadReferenceData(service)), runSql: sqlJsRunner, runPython: runLocalPython });
  if (report.ok) await markValidated(service, { id });
  return report;
}

export type StatusAction = "publish" | "retire" | "approve-legacy";

export async function applyStatusAction(service: Service, id: string, action: StatusAction, adminId: string): Promise<void> {
  if (action === "publish") return publishChallenge(service, { id }, adminId);
  if (action === "retire") return retireChallenge(service, { id });
  return approveLegacyDraft(service, id, adminId);
}
