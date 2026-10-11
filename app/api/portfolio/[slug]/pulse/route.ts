import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { portfolioPulse } from "@/lib/portfolio/pulse";

/** Public: the fingerprint of a shared portfolio. Answers only while the student's own portfolio_public switch is on; carries no portfolio content. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id").eq("portfolio_slug", slug).eq("portfolio_public", true).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // a few seconds of shared caching so many open tabs cost one read, not one each
  return NextResponse.json(await portfolioPulse(service, profile.id), { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } });
}
