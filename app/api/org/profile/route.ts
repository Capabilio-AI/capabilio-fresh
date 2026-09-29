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
    if (body.city !== undefined || body.state !== undefined) {
      const { error: locError } = await service.from("institutions").update({ city: body.city ?? null, state: body.state ?? null }).eq("id", ctx.institutionId);
      if (locError) throw locError;
    }
    return {};
  });
}
