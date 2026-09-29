import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PostEditSchema } from "@/lib/org/schemas";
import { untyped, type OrgPostRow } from "@/lib/org/db";

/** Edit a post's text. Non-admins may edit only their own posts. */
export async function POST(request: Request) {
  return orgRoute(request, PostEditSchema, "publishPost", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("org_posts").select("*").eq("id", body.postId).eq("institution_id", ctx.institutionId).maybeSingle();
    const post = data as OrgPostRow | null;
    if (!post || (ctx.kind !== "admin" && post.author_membership_id !== ctx.membershipId)) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const { error } = await db.from("org_posts").update({ body: body.body, title: (post.type === "event" ? post.title : body.body.split("\n")[0]).slice(0, 200) }).eq("id", post.id);
    if (error) throw error;
    return {};
  });
}
