import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { claimWriter } from "@/lib/roadmap-visual/guide-store";
import { loadProjectResource, projectsMissingGuides, writeProjectGuide } from "@/lib/roadmap-visual/guide-writer";

export const maxDuration = 300;

const PER_RUN = 8;

/** Daily (see vercel.json; the Hobby plan allows nothing more frequent). Writes the guide and practice data for projects that have none yet, so students find them ready. Fails closed without CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const service = createServiceClient();
  const written: string[] = [];
  const failed: string[] = [];
  const started = Date.now();
  for (const id of await projectsMissingGuides(service, PER_RUN)) {
    if (Date.now() - started > 200_000) break; // leave room inside the function's time limit
    if ((await claimWriter(service, id)) === "busy") continue;
    const resource = await loadProjectResource(service, id);
    if (!resource) continue;
    try {
      await writeProjectGuide(service, resource, null);
      written.push(id);
    } catch {
      failed.push(id);
    }
  }
  return NextResponse.json({ ok: true, written: written.length, failed: failed.length });
}
