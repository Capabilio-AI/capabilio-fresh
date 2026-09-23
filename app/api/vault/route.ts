import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getVaultItems } from "@/lib/vault/data";

const ItemTypeSchema = z.enum(["certificate", "project", "resume", "link", "other"]);

const CreateSchema = z.object({
  itemType: ItemTypeSchema,
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional().or(z.literal("")),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const items = await getVaultItems(supabase, auth.userId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      user_id: auth.userId,
      item_type: parsed.data.itemType,
      title: parsed.data.title,
      url: parsed.data.url || null,
      description: parsed.data.description || null,
    })
    .select("id, item_type, title, url, description, created_at")
    .single();
  if (error) throw error;

  return NextResponse.json({ item: data }, { status: 201 });
}
