import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { CompanyInput } from "@/lib/crt/companies";
import { listAllCompanies, saveCompany, setCompanyStatus } from "@/lib/crt/company-server";

const Status = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), status: z.enum(["DRAFT", "PUBLISHED"]) }).strict();
const reply = (out: { ok: true } | { ok: false; status: number; error: string }, extra: Record<string, unknown> = {}) => (out.ok ? NextResponse.json({ ...extra, ...out }) : NextResponse.json({ error: out.error }, { status: out.status }));

export async function GET() {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ companies: await listAllCompanies(createServiceClient()) });
}

/** Saves a company and its rounds as a draft (or keeps it published while it still meets the publishing rules). */
export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = CompanyInput.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues.map((i) => `${i.path.join(".") || "company"}: ${i.message}`).join("; ") }, { status: 400 });
  try {
    return reply(await saveCompany(createServiceClient(), auth.userId, body.data));
  } catch (e) {
    console.error("[crt-admin/companies]", e);
    return NextResponse.json({ error: "Could not save the company." }, { status: 500 });
  }
}

/** Publish or unpublish. Publishing needs the pattern's source link, the date it was checked, and at least one paper. */
export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const body = Status.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    return reply(await setCompanyStatus(createServiceClient(), body.data.slug, body.data.status));
  } catch (e) {
    console.error("[crt-admin/companies]", e);
    return NextResponse.json({ error: "Could not change the status." }, { status: 500 });
  }
}
