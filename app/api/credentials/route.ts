import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { findTrack } from "@/lib/languages";
import { loadModuleProofs } from "@/lib/languages/module-proof";
import { trackEvidence } from "@/lib/credentials/credential";
import { allLevelsProven } from "@/lib/languages/year-exam";
import { loadKeys } from "@/lib/credentials/sign";
import { issueTrackCredential } from "@/lib/credentials/store";

const Body = z.object({ track: z.string().min(1).max(20), showName: z.boolean(), showCode: z.boolean().default(false) }).strict();

/**
 * A student claims the Proven Skill credential for a track. It is issued only when the server finds every module of the track proven; nothing the browser sends
 * counts as proof. The student chooses whether their name, and separately their solution code, is on the public page.
 */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Choose a course and whether to show your name." }, { status: 400 });
  const limit = await checkRateLimit(auth.userId, { bucket: "credential_claim", maxRequests: 10, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const keys = loadKeys(process.env.CREDENTIAL_SIGNING_KEY);
  if (!keys) return NextResponse.json({ error: "Credentials are not switched on yet. Please try again later." }, { status: 503 });
  const track = findTrack(body.data.track);
  if (!track) return NextResponse.json({ error: "That course does not exist." }, { status: 404 });

  const service = createServiceClient();
  const proofs = await loadModuleProofs(service, auth.userId, track.key);
  const evidence = trackEvidence(track, proofs);
  if (!evidence.ok) return NextResponse.json({ error: "Prove every module first.", remaining: evidence.remaining }, { status: 409 });
  if (!(await allLevelsProven(service, auth.userId, track, proofs))) return NextResponse.json({ error: "Pass the year exam of every level first." }, { status: 409 });

  let holder: string | null = null;
  if (body.data.showName) {
    const { data } = await service.from("profiles").select("full_name").eq("id", auth.userId).maybeSingle();
    holder = (data as { full_name: string | null } | null)?.full_name?.trim().slice(0, 80) || null;
  }
  try {
    const { credential, created } = await issueTrackCredential(service, { userId: auth.userId, track, holder, modules: evidence.modules, showCode: body.data.showCode, keys });
    return NextResponse.json({ code: credential.code, url: `/verify/${credential.code}`, created, revoked: Boolean(credential.revoked_at) });
  } catch (e) {
    console.error("[credentials] issue failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not issue the credential. Please try again." }, { status: 500 });
  }
}
