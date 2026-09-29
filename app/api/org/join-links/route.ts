import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { JoinLinkSchema } from "@/lib/org/schemas";
import { joinUrl, newJoinCode } from "@/lib/org/team";
import { untyped } from "@/lib/org/db";

/** Create a shareable link students use to join THIS college (optionally pre-filling branch and graduation year). */
export async function POST(request: Request) {
  return orgRoute(request, JoinLinkSchema, "approveMembers", async ({ ctx, service }, body) => {
    const db = untyped(service);
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newJoinCode();
      const { error } = await db.from("org_join_links").insert({
        institution_id: ctx.institutionId,
        code,
        label: body.label ?? null,
        branch: body.branch ?? null,
        end_year: body.endYear ?? null,
        created_by_membership_id: ctx.membershipId,
      });
      if (!error) return { code, url: joinUrl(new URL(request.url).origin, code) };
      if (error.code !== "23505") throw error;
    }
    return NextResponse.json({ error: "Couldn't create a link. Please try again." }, { status: 500 });
  });
}
