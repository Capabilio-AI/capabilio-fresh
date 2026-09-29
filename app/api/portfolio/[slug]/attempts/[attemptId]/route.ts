import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAttemptEvidence } from "@/lib/arena/attempt-evidence";

/** Public — backs the recruiter-facing evidence popup on a shared portfolio link. No session required; gated entirely on the profile's own portfolio_public flag. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; attemptId: string }> }) {
  const { slug, attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id").eq("portfolio_slug", slug).eq("portfolio_public", true).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const evidence = await getAttemptEvidence(service, attemptId, profile.id);
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(evidence);
}
