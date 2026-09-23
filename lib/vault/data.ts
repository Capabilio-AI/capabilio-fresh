import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface VaultItem {
  id: string;
  item_type: string;
  title: string;
  url: string | null;
  description: string | null;
  created_at: string;
}

export async function getVaultItems(supabase: SupabaseClient<Database>, userId: string): Promise<VaultItem[]> {
  const { data, error } = await supabase
    .from("vault_items")
    .select("id, item_type, title, url, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
