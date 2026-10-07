import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { expertiseTags, getMyMentorProfile, listMentors } from "@/lib/pulse/mentors";

const Query = z.object({ q: z.string().trim().max(80).optional(), tag: z.string().trim().max(40).optional() });

/** The mentor directory, the tags to filter by, and the caller's own mentor profile (for the apply / edit card). */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const service = createServiceClient();
  const [mentors, tags, mine] = await Promise.all([listMentors(service, auth.userId, q.data), expertiseTags(service), getMyMentorProfile(service, auth.userId)]);
  return NextResponse.json({ mentors, tags, mine });
}
