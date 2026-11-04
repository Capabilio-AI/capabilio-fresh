import { NextResponse } from "next/server";
import { z } from "zod";
import { orgRoute } from "@/lib/api/org-route";
import { untyped } from "@/lib/org/db";
import { removeMedia } from "@/lib/pulse/media";

const Body = z.object({ id: z.string().uuid() }).strict();

/** Staff take down a material they shared (admins, any at their college). A file shared with several groups is removed from storage only with its last row. */
export async function POST(request: Request) {
  return orgRoute(request, Body, "uploadMaterial", async ({ ctx, service }, body) => {
    const db = untyped(service);
    const { data } = await db.from("class_materials").select("id, file_path, author_membership_id").eq("id", body.id).eq("institution_id", ctx.institutionId).maybeSingle();
    const row = data as { id: string; file_path: string | null; author_membership_id: string } | null;
    if (!row || (ctx.kind !== "admin" && row.author_membership_id !== ctx.membershipId)) return NextResponse.json({ error: "Material not found." }, { status: 404 });
    const { error } = await db.from("class_materials").delete().eq("id", row.id);
    if (error) throw error;
    if (row.file_path) {
      const { count } = await db.from("class_materials").select("id", { count: "exact", head: true }).eq("file_path", row.file_path);
      if (!count) await removeMedia(service, [row.file_path]);
    }
    return {};
  });
}
