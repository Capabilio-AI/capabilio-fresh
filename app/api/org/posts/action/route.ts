import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PostActionSchema } from "@/lib/org/schemas";
import { untyped, type OrgPostRow } from "@/lib/org/db";

export async function POST(request: Request) {
  return orgRoute(request, PostActionSchema, "publishPost", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("org_posts").select("*").eq("id", body.postId).eq("institution_id", ctx.institutionId).maybeSingle();
    const post = data as OrgPostRow | null;
    // non-admins only touch their own posts; admins any post of their institution
    if (!post || (ctx.kind !== "admin" && post.author_membership_id !== ctx.membershipId)) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    const { error } =
      body.action === "delete"
        ? await db.from("org_posts").delete().eq("id", post.id)
        : await db
            .from("org_posts")
            .update(body.action === "publish" ? { status: "published", published_at: new Date().toISOString() } : { status: "draft", published_at: null })
            .eq("id", post.id);
    if (error) throw error;
    return {};
  });
}
