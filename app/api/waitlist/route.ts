import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";

const WaitlistSchema = z
  .object({
    path: z.enum(["professional", "executive"]),
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    roleTitle: z.string().trim().max(120).optional(),
    company: z.string().trim().max(200).optional(),
  })
  .strict();

// Per-instance throttle: a public form with no login, so keep one address from filling the table.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function allowed(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  return true;
}

/** Early-access list for the Professional and Executive paths. Creates no account and returns the same answer for a repeat email. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowed(ip)) return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });

  const parsed = WaitlistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { path, fullName, email, roleTitle, company } = parsed.data;

  const { error } = await untyped(createServiceClient())
    .from("path_waitlist")
    .insert({ path, full_name: fullName, email, role_title: roleTitle || null, company: company || null });
  // 23505 = this email is already on the list: same success answer, so the form cannot be used to probe the list.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
