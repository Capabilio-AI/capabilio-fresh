import { orgRoute } from "@/lib/api/org-route";
import { ProfileSchema } from "@/lib/org/schemas";
import { untyped } from "@/lib/org/db";

/** Only an org admin edits the public page; `is_public` is what opts the organisation into being browsable. */
export async function POST(request: Request) {
  return orgRoute(request, ProfileSchema, "manageProfile", async ({ ctx, service }, body) => {
    const { error } = await untyped(service).from("org_profiles").upsert({
      institution_id: ctx.institutionId,
      bio: body.bio ?? null,
      cover_image_url: body.coverImageUrl ?? null,
      website_url: body.websiteUrl ?? null,
      is_public: body.isPublic,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return {};
  });
}
