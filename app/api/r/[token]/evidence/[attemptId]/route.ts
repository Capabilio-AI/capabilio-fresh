import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evidenceFromRecord } from "@/lib/arena/attempt-evidence";
import { getEvidenceRecord } from "@/lib/evidence/records";
import { findShareByToken } from "@/lib/recruiter/shares";
import { mayOpen } from "@/lib/recruiter/share";

/**
 * Opens the evidence of one sealed task for a recruiter, with no session: the share link is the permission. It answers only for an active link and a task
 * the student put in that link. Every other case (unknown link, expired, revoked, a task not in the share, a malformed id) is the same 404, so the route
 * reveals nothing about which links or tasks exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; attemptId: string }> }) {
  const { token, attemptId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return notFound();

  const service = createServiceClient();
  const share = await findShareByToken(service, token);
  if (!share || !mayOpen(share, attemptId, new Date())) return notFound();

  const record = await getEvidenceRecord(service, attemptId, share.userId);
  if (!record) return notFound();
  return NextResponse.json(evidenceFromRecord(record), { headers: { "Cache-Control": "private, no-store" } });
}
