import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { loadPublicOrg } from "@/lib/org/public-org";
import { listOrgFollowers, parseCursor } from "@/lib/org/followers";

const Query = z.object({ slug: z.string().min(1).max(200) });

/**
 * Who follows a college page. Signed-in people only, and only for a college they may see (a public page, or one they belong to): the same
 * visibility as the page itself. `before` is the cursor of the last person already loaded.
 */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const parsed = Query.safeParse({ slug: url.searchParams.get("slug") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const before = url.searchParams.get("before");
  if (before && !parseCursor(before)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const org = await loadPublicOrg(service, parsed.data.slug, auth.userId);
  if (!org) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  return NextResponse.json(await listOrgFollowers(service, auth.userId, org.institutionId, before));
}
