import { NextResponse } from "next/server";
import { orgRoute } from "@/lib/api/org-route";
import { ProfileSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** Only an org admin edits the public page; `is_public` is what opts the organisation into being browsable. */
export async function POST(request: Request) {
  return orgRoute(request, ProfileSchema, "manageProfile", async ({ ctx, service }, body) => {
    // logo_url / cover_image_url are deliberately absent: an upsert must not wipe pictures set by the upload route
    const { error } = await untyped(service).from("org_profiles").upsert({
      institution_id: ctx.institutionId,
      tagline: body.tagline ?? null,
      bio: body.bio ?? null,
      website_url: body.websiteUrl ?? null,
      founded_year: body.foundedYear ?? null,
      is_public: body.isPublic,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    if (body.collegeCode !== undefined) {
      const { error: codeError } = await service.from("institutions").update({ college_code: body.collegeCode }).eq("id", ctx.institutionId);
      // 23505: another college already uses this code
      if (codeError?.code === "23505") return NextResponse.json({ error: "Another college already uses that code. Choose a different one." }, { status: 409 });
      if (codeError) throw codeError;
    }
    if (body.city !== undefined || body.state !== undefined) {
      const { error: locError } = await service.from("institutions").update({ city: body.city ?? null, state: body.state ?? null }).eq("id", ctx.institutionId);
      if (locError) throw locError;
    }
    return {};
  });
}
