import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerRoute } from "@/lib/api/viewer-route";
import { loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { untyped, type OrgPostRow } from "@/lib/org/db";
import { notifyPostAuthor } from "@/lib/notifications/events";

const Schema = z.object({ postId: z.string().uuid(), liked: z.boolean() }).strict();

export async function POST(request: Request) {
  return viewerRoute(request, Schema, async ({ userId, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("org_posts").select("id, institution_id, author_membership_id").eq("id", body.postId).maybeSingle();
    const post = data as Pick<OrgPostRow, "id" | "institution_id" | "author_membership_id"> | null;
    const { data: inst } = post ? await service.from("institutions").select("slug").eq("id", post.institution_id).maybeSingle() : { data: null };
    const org = inst ? await loadPublicOrg(service, inst.slug, userId) : null;
    // only a post the viewer is allowed to see can be liked
    if (!post || !org || (await loadVisiblePosts(service, org, userId, post.id)).length === 0) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    const { error } = body.liked
      ? await db.from("org_post_likes").upsert({ post_id: post.id, user_id: userId })
      : await db.from("org_post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    if (body.liked && inst) await notifyPostAuthor(service, { postId: post.id, authorMembershipId: post.author_membership_id, institutionId: post.institution_id, institutionSlug: inst.slug, actorId: userId, type: "post_like", verb: "liked your post" });
    return {};
  });
}
