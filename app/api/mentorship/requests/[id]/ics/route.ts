import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { createClient } from "@/lib/supabase/server";
import { buildIcs, isUuid } from "@/lib/mentorship/rules";
import { sessionForIcs } from "@/lib/mentorship/server";

/** A confirmed session as a calendar file, for the mentor or the mentee of that session only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const s = isUuid(id) ? await sessionForIcs(auth.userId, id) : null;
  if (!s) return NextResponse.json({ error: "That session was not found." }, { status: 404 });
  const file = buildIcs({ id: s.id, startsAt: s.startsAt, endsAt: s.endsAt, title: `Mentoring: ${s.topic}`, description: `${s.mentorName} with ${s.menteeName}. Join: ${s.meetingUrl}`, url: s.meetingUrl });
  return new Response(file, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="mentoring-session.ics"', "Cache-Control": "private, no-store" } });
}
