import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerRoute } from "@/lib/api/viewer-route";
import { loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { untyped, type OrgPostRow } from "@/lib/org/db";

const Schema = z.object({ postId: z.string().uuid(), going: z.boolean() }).strict();

/** RSVP to an EVENT the viewer is allowed to see (same visibility rules as the page). */
export async function POST(request: Request) {
  return viewerRoute(request, Schema, async ({ userId, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("org_posts").select("id, institution_id, type").eq("id", body.postId).maybeSingle();
    const post = data as Pick<OrgPostRow, "id" | "institution_id" | "type"> | null;
    const { data: inst } = post ? await service.from("institutions").select("slug").eq("id", post.institution_id).maybeSingle() : { data: null };
    const org = inst ? await loadPublicOrg(service, inst.slug, userId) : null;
    if (!post || post.type !== "event" || !org || (await loadVisiblePosts(service, org, userId, post.id)).length === 0) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const { error } = body.going
      ? await db.from("org_event_rsvps").upsert({ post_id: post.id, user_id: userId })
      : await db.from("org_event_rsvps").delete().eq("post_id", post.id).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    return {};
  });
}
