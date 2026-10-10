import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getSpin, revealSpin, spinWheel } from "@/lib/arena-challenges/spin";

const Body = z.object({ action: z.enum(["spin", "reveal"]) });

/** This week's wheel state for the signed-in student. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json(await getSpin(createServiceClient(), auth.userId));
}

export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const service = createServiceClient();
  const state = body.data.action === "spin" ? await spinWheel(service, auth.userId) : await revealSpin(service, auth.userId);
  if (body.data.action === "reveal" && !state.spin) return NextResponse.json({ error: "Spin the wheel first" }, { status: 409 });
  return NextResponse.json(state);
}
