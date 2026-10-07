import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";
import { RuntimeSettingsPatch, loadRuntimeAdmin, updateRuntimeSettings } from "@/lib/arena-content/runtime-admin";

/** Per-workstation kill switch, daily caps, and the last 24h of usage. */
export async function GET() {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json({ runtimes: await loadRuntimeAdmin(createServiceClient()) });
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const patch = RuntimeSettingsPatch.safeParse(await request.json().catch(() => null));
  if (!patch.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  try {
    await updateRuntimeSettings(createServiceClient(), patch.data, auth.userId);
    return NextResponse.json({ runtimes: await loadRuntimeAdmin(createServiceClient()) });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status) return NextResponse.json({ error: (error as Error).message }, { status });
    console.error("[arena-admin/runtime-settings]", error);
    return NextResponse.json({ error: "Could not update the setting." }, { status: 500 });
  }
}
