import { NextResponse } from "next/server";
import { z } from "zod";
import { orgRoute } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { removeMedia } from "@/lib/pulse/media";

const Body = z.object({ shareIds: z.array(z.string().uuid()).min(1).max(50) }).strict();

/**
 * Staff take down things they shared (admins, anything at their college). A share is removed as a whole, for every branch and year it went to.
 * A file is deleted from storage only when no other row still uses it.
 */
export async function POST(request: Request) {
  return orgRoute(request, Body, "uploadMaterial", async ({ ctx, service }, body) => {
    const db = untyped(service);
    let q = db.from("class_materials").select("id, file_path, author_membership_id").eq("institution_id", ctx.institutionId).in("share_id", body.shareIds);
    if (ctx.kind !== "admin") q = q.eq("author_membership_id", ctx.membershipId);
    const { data } = await q;
    const rows = (data ?? []) as { id: string; file_path: string | null }[];
    if (rows.length === 0) return NextResponse.json({ error: "Nothing to remove." }, { status: 404 });
    const { error } = await db.from("class_materials").delete().in("id", rows.map((r) => r.id));
    if (error) throw error;
    for (const path of new Set(rows.flatMap((r) => (r.file_path ? [r.file_path] : [])))) {
      const { count } = await db.from("class_materials").select("id", { count: "exact", head: true }).eq("file_path", path);
      if (!count) await removeMedia(service, [path]);
    }
    return { removed: body.shareIds.length };
  });
}
