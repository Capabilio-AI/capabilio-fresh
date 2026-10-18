import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerRoute } from "@/lib/api/viewer-route";
import { loadPublicOrg } from "@/lib/org/public-org";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { staffWithPermission } from "@/lib/notifications/audiences";

const Schema = z.object({ slug: z.string().min(1).max(200), following: z.boolean() }).strict();

export async function POST(request: Request) {
  return viewerRoute(request, Schema, async ({ userId, service }, body) => {
    const org = await loadPublicOrg(service, body.slug, userId); // null unless public or the viewer is a member
    if (!org) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    const db = untyped(service);
    const { error } = body.following
      ? await db.from("org_follows").upsert({ institution_id: org.institutionId, user_id: userId })
      : await db.from("org_follows").delete().eq("institution_id", org.institutionId).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    if (body.following) {
      const { data: me } = await service.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      await notify(service, {
        userIds: await staffWithPermission(service, org.institutionId, "page"),
        type: "org_follow",
        title: `${me?.full_name ?? "Someone"} started following your college page`,
        href: "/org/college",
        actorId: userId,
        institutionId: org.institutionId,
        dedupeKey: `org-follow:${org.institutionId}:${userId}`,
      });
    }
    return {};
  });
}
