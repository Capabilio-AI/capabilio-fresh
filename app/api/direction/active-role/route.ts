import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { switchActiveRole } from "@/lib/career/direction-writes";
import { ActiveRoleBodySchema } from "@/lib/career/schemas";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";

/** Higher Studies "Switch": retarget the signed-in student's active Arena domain role. Prior evidence is never touched. */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = ActiveRoleBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const roles = await listEnabledRoles(service);
  const result = await switchActiveRole(service, auth.userId, parsed.data.roleKey, roles.map((r) => r.role_key));
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, roleKey: parsed.data.roleKey });
}
