import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { untyped } from "@/lib/org/db";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
  countOnly: z.enum(["1"]).optional(),
});

export interface StoredNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/** The signed-in person's own notifications, newest first, plus how many are unread. Read-only; always scoped to them. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const db = untyped(createServiceClient());
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", auth.userId).is("read_at", null);
  if (q.data.countOnly) return NextResponse.json({ unread: count ?? 0 });

  let query = db.from("notifications").select("id, type, title, body, href, read_at, created_at").eq("user_id", auth.userId).order("created_at", { ascending: false }).limit(q.data.limit);
  if (q.data.before) query = query.lt("created_at", q.data.before);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  const items: StoredNotification[] = (data ?? []).map((r: { id: string; type: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.read_at !== null,
    createdAt: r.created_at,
  }));
  return NextResponse.json({ unread: count ?? 0, items });
}
