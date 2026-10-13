import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { buildAccountExport, type ExportClient } from "@/lib/settings/export";

export const dynamic = "force-dynamic";

/** Downloads everything Capabilio holds about the signed-in person as one JSON file. Only ever reads the caller's own rows. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const limit = await checkRateLimit(auth.userId, { bucket: "account-export", maxRequests: 5, windowSeconds: 3600 });
  if (!limit.allowed) return NextResponse.json({ error: "Too many exports. Try again in an hour." }, { status: 429 });

  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;

  const file = await buildAccountExport(createServiceClient() as unknown as ExportClient, { id: auth.userId, email }, new Date());
  const day = file.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="capabilio-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
