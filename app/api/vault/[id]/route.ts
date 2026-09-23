import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  // RLS (vault_items_delete_own) already scopes this to the caller's own
  // rows — the .eq is defense in depth, not the only guard.
  const { error } = await supabase.from("vault_items").delete().eq("id", id).eq("user_id", auth.userId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
