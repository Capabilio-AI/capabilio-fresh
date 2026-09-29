import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { PostSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";
import { ownPathFromPublicUrl } from "@/lib/org/media";

/** Events + announcements only. Staff and admins may publish (spec default); staff edit only their own (see /action). */
export async function POST(request: Request) {
  return orgRoute(request, PostSchema, "publishPost", async ({ ctx, service }, body) => {
    const startsAt = body.eventStartsAt ? new Date(body.eventStartsAt) : null;
    if (body.type === "event" && (!startsAt || Number.isNaN(startsAt.getTime()))) {
      return NextResponse.json({ error: "Enter a valid event date and time." }, { status: 400 });
    }
    // a photo must be one this college uploaded through /api/org/media — never an arbitrary external URL
    if (body.coverImageUrl && !ownPathFromPublicUrl(body.coverImageUrl, "org-media", ctx.institutionId)) {
      return NextResponse.json({ error: "Upload the photo from here instead of pasting a link." }, { status: 400 });
    }
    const isEvent = body.type === "event";
    const { error } = await untyped(service).from("org_posts").insert({
      institution_id: ctx.institutionId,
      author_membership_id: ctx.membershipId,
      type: body.type,
      title: (body.title ?? body.body.split("\n")[0]).slice(0, 200),
      body: body.body,
      cover_image_url: body.coverImageUrl ?? null,
      event_starts_at: isEvent ? startsAt!.toISOString() : null,
      event_location: isEvent ? (body.eventLocation ?? null) : null,
      event_link: isEvent ? (body.eventLink ?? null) : null,
      is_public: body.isPublic,
      status: body.publish ? "published" : "draft",
      published_at: body.publish ? new Date().toISOString() : null,
    });
    if (error) throw error;
    return {};
  });
}
